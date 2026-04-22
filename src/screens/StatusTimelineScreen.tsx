// src/screens/StatusTimelineScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from "react-native";
import { fetchStatuses, Status } from "../functions/StatusFunctions";

export default function StatusTimelineScreen({ navigation, currentUserId }: { navigation: any, currentUserId: string }) {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatuses = async () => {
      setLoading(true);
      const allStatuses = await fetchStatuses();
      setStatuses(allStatuses);
      setLoading(false);
    };
    loadStatuses();
  }, []);

  const renderItem = ({ item }: { item: Status }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate("ViewStatusScreen", { statusId: item.id, currentUserId })}
    >
      <Image
        source={{ uri: item.userPhoto || "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
        style={styles.avatar}
      />
      <View style={{ marginLeft: 10 }}>
        <Text style={styles.name}>{item.userName}</Text>
        <Text style={styles.time}>{item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : ""}</Text>
      </View>
      {item.seenBy.includes(currentUserId) ? (
        <Text style={styles.seenText}>Seen</Text>
      ) : (
        <Text style={styles.unseenText}>New</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={statuses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", padding: 15, alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: "#222" },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: "#00ff88" },
  name: { color: "#fff", fontSize: 16 },
  time: { color: "#888", fontSize: 12 },
  seenText: { color: "#888", marginLeft: "auto" },
  unseenText: { color: "#00ff88", marginLeft: "auto", fontWeight: "bold" },
});
