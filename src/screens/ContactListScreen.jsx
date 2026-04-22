// src/screens/ContactListScreen.jsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

export default function ContactListScreen({ navigation, route }) {
  const user = auth().currentUser;
  const currentUid = user ? user.uid : null;

  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);

  // -----------------------------
  // DELETE CHAT
  // -----------------------------
  const deleteChat = (chat) => {
  Alert.alert("Delete Chat", "Do you want to delete this chat?", [
    { text: "Cancel", style: "cancel" },
    {
      text: "Delete",
      style: "destructive",
      onPress: async () => {
        try {
          const collectionName = chat.isGroup ? "groups" : "chats";

          await firestore()
            .collection(collectionName)
            .doc(chat.chatId)
            .delete();

        } catch (error) {
          console.log("Delete error:", error);
        }
      },
    },
  ]);
};


  // -----------------------------
  // FETCH CURRENT USER PROFILE
  // -----------------------------
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = firestore()
      .collection("users")
      .doc(currentUid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          setCurrentUserData(doc.data());
        }
      });

    return unsubscribe;
  }, [currentUid]);

  // -----------------------------
  // FETCH CHATS
  // -----------------------------
  useEffect(() => {
    if (!currentUid) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("chats")
      .where("participants", "array-contains", currentUid)
      .onSnapshot(async (snapshot) => {
        try {
          if (!snapshot || snapshot.empty) {
            setUsers([]);
            setTotalUnread(0);
            setLoading(false);
            return;
          }

          const chatList = await Promise.all(
            snapshot.docs.map(async (doc) => {
              const chatData = doc.data() || {};
              const chatId = doc.id;
              const isGroup = chatData.isGroup === true;

              let unreadCount = 0;

try {

  if (isGroup) {
    // ✅ GROUP UNREAD
    const messagesSnap = await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .get();

    unreadCount = messagesSnap.docs.filter(
      (m) => !m.data()?.seenBy?.includes(currentUid)
    ).length;

  } else {
    // ✅ 1-to-1 UNREAD
    const messagesSnap = await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .where("receiverId", "==", currentUid)
      .where("seen", "==", false)
      .get();

    unreadCount = messagesSnap.size;
  }

} catch (err) {
  console.log("Unread error:", err);
}


              if (isGroup) {
                return {
                  id: chatId,
                  chatId,
                  name: chatData.name || "Group",
                  profilePic: chatData.groupPhoto || null,
                  lastMessage: chatData.lastMessage || "",
                  unreadCount,
                  isTyping: false,
                  isGroup: true,
                };
              }

              const participants = chatData.participants || [];
              const otherUserId = participants.find((id) => id !== currentUid);

              if (!otherUserId) return null;

              let userData = {};

              try {
                const userDoc = await firestore()
                  .collection("users")
                  .doc(otherUserId)
                  .get();

                if (userDoc.exists) {
                  userData = userDoc.data() || {};
                }
              } catch (err) {
                console.log("User fetch error:", err);
              }

              return {
                id: otherUserId,
                chatId,
                name: userData.name || "User",
                phone: userData.phone || "",
                profilePic: userData.profilePic || null,
                lastMessage: chatData.lastMessage || "",
                unreadCount,
                isTyping:
                  chatData.typing && chatData.typing[otherUserId]
                    ? true
                    : false,
                isGroup: false,
              };
            })
          );

          const filtered = chatList.filter(
  (item) => item && item.isGroup === false
);


          setUsers(filtered);

          const total = filtered.reduce(
            (acc, item) => acc + (item.unreadCount || 0),
            0
          );

          setTotalUnread(total);
        } catch (err) {
          console.log("CHAT LOAD ERROR:", err);
        }

        setLoading(false);
      });

    return unsubscribe;
  }, [currentUid]);

  // -----------------------------
// FETCH GROUPS
// -----------------------------
useEffect(() => {
  if (!currentUid) return;

  const unsubscribe = firestore()
    .collection("groups")
    .where("participants", "array-contains", currentUid)
    .onSnapshot(async (snapshot) => {
      try {
        if (!snapshot || snapshot.empty) {
          setGroups([]);
          return;
        }

        const groupList = snapshot.docs.map((doc) => {
          const data = doc.data() || {};

          return {
            id: doc.id,
            chatId: doc.id,
            name: data.name || "Group",
            profilePic: data.groupPhoto || null,
            lastMessage: data.lastMessage || "",
            unreadCount: 0,
            isTyping: false,
            isGroup: true,
          };
        });

        setGroups(groupList);
      } catch (err) {
        console.log("GROUP LOAD ERROR:", err);
      }
    });

  return unsubscribe;
}, [currentUid]);

  // -----------------------------
  // RENDER ITEM
  // -----------------------------
  const renderItem = ({ item }) => {
    if (!item) return null;

    return (
      <TouchableOpacity
        style={styles.userRow}
        onPress={() => {
          if (route?.params?.fromCall) {
            navigation.navigate("OutgoingCall", {
              calleeId: item.id,
              calleeName: item.name,
              calleeNumber: item.phone,
            });
            return;
          }

          navigation.navigate("Chat", {
            chatId: item.chatId,
            userId: item.isGroup ? null : item.id,
            userName: item.name,
            userPhone: item.phone,
            userPhoto: item.profilePic,
            groupId: item.isGroup ? item.chatId : null,
            groupName: item.isGroup ? item.name : null,
            isGroup: item.isGroup,
            participants: item.participants || [],
          });
        }}
        onLongPress={() => deleteChat(item)}
      >
        <Image
          source={{
            uri: item.profilePic || "https://i.pravatar.cc/300",
          }}
          style={styles.avatar}
        />

        <View style={styles.textContainer}>
          <Text
            style={[styles.name, item.isGroup && { color: "#00ff88" }]}
          >
            {item.name}
          </Text>

          <Text
            numberOfLines={1}
            style={[
              styles.message,
              item.unreadCount > 0 && styles.unreadText,
            ]}
          >
            {item.isTyping
              ? "typing..."
              : item.lastMessage || "Tap to chat"}
          </Text>
        </View>

        {item.unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // -----------------------------
  // LOADING
  // -----------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate("MyProfile")}>
          <Image
            source={{
              uri:
                currentUserData?.profilePic ||
                "https://i.pravatar.cc/150",
            }}
            style={styles.headerAvatar}
          />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>NUKKAD</Text>

          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {totalUnread}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("NewChat", { groupMode: true })
            }
            style={{ marginRight: 15 }}
          >
            <Icon name="account-group" size={26} color="#00ff88" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => auth().signOut()}>
            <Text style={styles.logout}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* LIST */}
      <FlatList
        data={[...groups, ...(users || [])]}
        keyExtractor={(item, index) =>
          (item.isGroup ? "group_" : "user_") + (item.chatId || index)
        }
        renderItem={renderItem}
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate("NewChat")}
      >
        <Text style={styles.fabText}>＋</Text>
      </TouchableOpacity>
    </View>
  );
}

// -----------------------------
// STYLES
// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },

  headerAvatar: { width: 40, height: 40, borderRadius: 20 },

  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },

  headerBadge: {
    backgroundColor: "red",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },

  headerBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },

  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  logout: {
    color: "#00ff88",
    fontWeight: "bold",
  },

  userRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
  },

  avatar: { width: 55, height: 55, borderRadius: 30 },

  textContainer: { flex: 1, marginLeft: 15 },

  name: { color: "#fff", fontSize: 16, fontWeight: "600" },

  message: { color: "#888", marginTop: 4 },

  unreadText: { color: "#fff", fontWeight: "bold" },

  badge: {
    backgroundColor: "#00ff88",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  badgeText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 12,
  },

  fab: {
    position: "absolute",
    bottom: 25,
    right: 25,
    backgroundColor: "#00ff88",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },

  fabText: {
    fontSize: 30,
    color: "#000",
  },
});
