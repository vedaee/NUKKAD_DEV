import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import firestore from "@react-native-firebase/firestore";

export default function MessageInfoScreen({ route }) {

  const { message, chatId } = route.params;

  const [deliveredUsers, setDeliveredUsers] = useState([]);
  const [seenUsers, setSeenUsers] = useState([]);

  useEffect(() => {

    const fetchUsers = async () => {

      const usersSnapshot = await firestore().collection("users").get();

      const usersMap = {};
      usersSnapshot.forEach(doc => {
        usersMap[doc.id] = doc.data().name || "User";
      });

      const delivered = (message.deliveredTo || [])
        .filter(uid => uid !== message.senderId)
        .map(uid => ({
          uid,
          name: usersMap[uid],
        }));

      const seen = (message.seenBy || [])
        .filter(uid => uid !== message.senderId)
        .map(uid => ({
          uid,
          name: usersMap[uid],
        }));

      setDeliveredUsers(delivered);
      setSeenUsers(seen);
    };

    fetchUsers();

  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.row}>
      <Text style={styles.name}>{item.name}</Text>
    </View>
  );

  return (
    <View style={styles.container}>

      <Text style={styles.title}>Delivered To</Text>
      <FlatList
        data={deliveredUsers}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
      />

      <Text style={styles.title}>Seen By</Text>
      <FlatList
        data={seenUsers}
        keyExtractor={(item) => item.uid}
        renderItem={renderItem}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 15,
  },
  title: {
    color: "#00ff88",
    fontSize: 16,
    marginTop: 10,
    marginBottom: 5,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: "#333",
  },
  name: {
    color: "#fff",
    fontSize: 15,
  },
});
