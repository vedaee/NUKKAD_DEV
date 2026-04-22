// src/screens/ViewStatusScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Image, Text, StyleSheet, TouchableOpacity } from "react-native";
import { fetchUserStatuses, markStatusSeen, Status } from "../functions/StatusFunctions";

export default function ViewStatusScreen({ route, navigation }: any) {
  const { statusId, currentUserId } = route.params;
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const loadStatus = async () => {
      // Fetch the specific user's statuses
      const allStatuses = await fetchUserStatuses(currentUserId);
      setStatuses(allStatuses);
    };
    loadStatus();
  }, [statusId]);

  useEffect(() => {
    if (statuses[index]) {
      markStatusSeen(statuses[index].id, currentUserId);
    }
  }, [statuses, index]);

  if (!statuses.length) {
    return <View style={styles.center}><Text style={{color:"#fff"}}>Loading...</Text></View>;
  }

  const nextStatus = () => {
    if (index < statuses.length - 1) {
      setIndex(index + 1);
    } else {
      navigation.goBack();
    }
  };

  const prevStatus = () => {
    if (index > 0) setIndex(index - 1);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.left} onPress={prevStatus} />
      <Image source={{ uri: statuses[index].mediaUrl }} style={styles.image} />
      <TouchableOpacity style={styles.right} onPress={nextStatus} />

      <View style={styles.userInfo}>
        <Image
          source={{ uri: statuses[index].userPhoto || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
          style={styles.avatar}
        />
        <Text style={styles.name}>{statuses[index].userName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  image: { width: "100%", height: "100%", resizeMode: "contain" },
  left: { position: "absolute", left: 0, top: 0, bottom: 0, width: "25%" },
  right: { position: "absolute", right: 0, top: 0, bottom: 0, width: "25%" },
  userInfo: { position: "absolute", top: 50, left: 20, flexDirection: "row", alignItems: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#00ff88" },
  name: { color: "#fff", marginLeft: 10, fontWeight: "bold", fontSize: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
