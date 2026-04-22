import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
} from "react-native";
import firestore from "@react-native-firebase/firestore";

const ForwardScreen = ({ route, navigation }) => {
  const { messageToForward, currentUser } = route.params;

  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("users")
      .onSnapshot((snapshot) => {
        const list = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((u) => u.id !== currentUser.uid);

        setUsers(list);
      });

    return unsubscribe;
  }, []);

  const toggleSelect = (user) => {
    if (selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers(
        selectedUsers.filter((u) => u.id !== user.id)
      );
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const generateChatId = (uid1, uid2) => {
    return [uid1, uid2].sort().join("_");
  };

  const forwardMessage = async () => {
    for (let user of selectedUsers) {
      const newChatId = generateChatId(
        currentUser.uid,
        user.id
      );

      await firestore()
        .collection("chats")
        .doc(newChatId)
        .collection("messages")
        .add({
          text: messageToForward.text || "",
          imageUrl: messageToForward.imageUrl || null,
          videoUrl: messageToForward.videoUrl || null,
          audioUrl: messageToForward.audioUrl || null,
          type: messageToForward.type,
          senderId: currentUser.uid,
          receiverId: user.id,
          status: "sent",
          seen: false,
          chatId: newChatId,
          forwarded: true,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
    }

    navigation.goBack();
  };

  // 🔎 Filter users by search
  const filteredUsers = users.filter((user) => {
    const name = user.name || user.email || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <View style={{ flex: 1, backgroundColor: "#121212" }}>
      
      {/* SEARCH BAR */}
      <View style={{ padding: 10 }}>
        <TextInput
          placeholder="Search..."
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
          style={{
            backgroundColor: "#1e1e1e",
            color: "#fff",
            padding: 10,
            borderRadius: 8,
          }}
        />
      </View>

      {/* USER LIST */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const selected = selectedUsers.find(
            (u) => u.id === item.id
          );

          return (
            <TouchableOpacity
              onPress={() => toggleSelect(item)}
              style={{
                padding: 15,
                backgroundColor: selected
                  ? "#1f3b4d"
                  : "#121212",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 16 }}>
                {item.name || item.email}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* SEND BUTTON */}
      {selectedUsers.length > 0 && (
        <TouchableOpacity
          onPress={forwardMessage}
          style={{
            backgroundColor: "#00ff88",
            padding: 15,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "bold" }}>
            Send ({selectedUsers.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ForwardScreen;
