// src/screens/NewChatScreen.jsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";

import Contacts from "react-native-contacts";
import Share from "react-native-share";

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

export default function NewChatScreen({ navigation, route }) {
  const currentUid = auth().currentUser?.uid;
  const { groupMode } = route.params || {};

  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");

  // -----------------------------
  // 🔥 NORMALIZE PHONE (STRICT)
  // -----------------------------
  const normalizePhone = (phone) => {
    if (!phone) return "";

    let cleaned = phone.replace(/\D/g, "");

    if (cleaned.length > 10) {
      cleaned = cleaned.slice(-10);
    }

    return cleaned;
  };

  // -----------------------------
  // PERMISSION
  // -----------------------------
  const requestPermission = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  // -----------------------------
  // 🔥 LOAD CONTACTS + FIREBASE USERS
  // -----------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const permission = await requestPermission();

        if (!permission) {
          setLoading(false);
          return;
        }

        // 🔥 STEP 1: GET ALL FIREBASE USERS
        const usersSnap = await firestore().collection("users").get();

        const usersMap = {};

        usersSnap.forEach((doc) => {
          const data = doc.data();

          const phone = normalizePhone(data.phone || data.phoneRaw);

          if (!phone) return;

          usersMap[phone] = {
            uid: doc.id,
            name: data.name,
            profilePic: data.profilePic,
            phone,
          };
        });

        // 🔥 STEP 2: LOAD DEVICE CONTACTS
        const deviceContacts = await Contacts.getAllWithoutPhotos();

        const mergedMap = {};

        deviceContacts.forEach((contact) => {
          if (!contact.phoneNumbers?.length) return;

          const raw = contact.phoneNumbers[0].number;

          const phone = normalizePhone(raw);

          if (!phone) return;

          if (mergedMap[phone]) return;

          const firebaseUser = usersMap[phone];

          mergedMap[phone] = {
            phone,
            name:
              contact.displayName ||
              contact.givenName ||
              "Unknown",

            isOnNukkad: !!firebaseUser,
            uid: firebaseUser?.uid || null,
            profilePic:
              firebaseUser?.profilePic ||
              "https://i.pravatar.cc/300",
          };
        });

        // 🔥 STEP 3: ADD FIREBASE USERS NOT IN CONTACTS
        Object.keys(usersMap).forEach((phone) => {
          if (mergedMap[phone]) return;

          const user = usersMap[phone];

          mergedMap[phone] = {
            phone,
            name: user.name || "NUKKAD User",
            isOnNukkad: true,
            uid: user.uid,
            profilePic: user.profilePic,
          };
        });

        const finalList = Object.values(mergedMap);

        finalList.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        setContacts(finalList);
        setLoading(false);

      } catch (err) {
        console.log("LOAD ERROR:", err);
        setLoading(false);
      }
    };

    load();
  }, []);

  // -----------------------------
  // TOGGLE GROUP SELECT
  // -----------------------------
  const toggleUser = (uid) => {
    setSelectedUsers((prev) =>
      prev.includes(uid)
        ? prev.filter((id) => id !== uid)
        : [...prev, uid]
    );
  };

  // -----------------------------
// START CHAT (1-to-1 ONLY)
// -----------------------------
const startChat = async (user) => {
  try {
    if (!user?.uid) return;

    const otherUid = user.uid;

    const chatId = [currentUid, otherUid]
      .sort()
      .join("_");

    const ref = firestore().collection("chats").doc(chatId);

    const doc = await ref.get();

    if (!doc.exists) {
      await ref.set({
        participants: [currentUid, otherUid],
        isGroup: false,

        lastMessage: "",
        lastMessageType: "",
        lastMessageTime: firestore.FieldValue.serverTimestamp(),

        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    }

    navigation.replace("Chat", {
      chatId,
      userId: otherUid,
      userName: user.name,
      userPhoto: user.profilePic,
      isGroup: false,
    });

  } catch (err) {
    console.log("CHAT ERROR:", err);
  }
};


  const createGroup = async () => {
  if (!groupName.trim()) {
    Alert.alert("Enter group name");
    return;
  }

  if (!selectedUsers.length) {
    Alert.alert("Select members");
    return;
  }

  try {
    // 🔥 Create group ID
    const ref = firestore().collection("groups").doc();
    const groupId = ref.id;

    const participants = [currentUid, ...selectedUsers];

    // ✅ 1. CREATE IN "groups"
    await ref.set({
      groupId,
      name: groupName,
      isGroup: true,
      participants,
      adminId: currentUid,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
      groupPhoto: null,
      lastMessage: "",
    });

    // ✅ 2. ALSO CREATE IN "chats" (VERY IMPORTANT)
    await firestore().collection("chats").doc(groupId).set({
      chatId: groupId,
      name: groupName,
      isGroup: true,
      participants,

      lastMessage: "",
      lastMessageType: "",
      lastMessageTime: firestore.FieldValue.serverTimestamp(),

      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ GROUP CREATED + ADDED TO CHATS:", groupId);

    navigation.goBack();

  } catch (err) {
    console.log("GROUP ERROR:", err);
    Alert.alert("Error", "Failed to create group");
  }
};



  // -----------------------------
  // INVITE
  // -----------------------------
  const inviteUser = async () => {
    try {
      await Share.open({
        message:
          "Join me on NUKKAD 🔥 https://play.google.com/store/apps/details?id=com.nukkad.app",
      });
    } catch {}
  };

  // -----------------------------
  // FILTER
  // -----------------------------
  const filtered = contacts.filter((item) => {
    const q = search.toLowerCase();

    return (
      item.name.toLowerCase().includes(q) ||
      item.phone.includes(q)
    );
  });

  // -----------------------------
  // UI
  // -----------------------------
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {groupMode && (
        <TextInput
          placeholder="Group Name"
          placeholderTextColor="#888"
          value={groupName}
          onChangeText={setGroupName}
          style={styles.input}
        />
      )}

      <TextInput
        placeholder="Search..."
        placeholderTextColor="#888"
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.phone}
        renderItem={({ item }) => {
          const selected = selectedUsers.includes(item.uid);

          return (
            <TouchableOpacity
              style={[
                styles.row,
                groupMode && selected && styles.selected,
              ]}
              onPress={() => {
                if (!item.isOnNukkad) return;

                if (groupMode) toggleUser(item.uid);
                else startChat(item);
              }}
            >
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>{item.phone}</Text>

                {item.isOnNukkad && (
                  <Text style={styles.onApp}>
                    On NUKKAD
                  </Text>
                )}
              </View>

              {!item.isOnNukkad ? (
                <TouchableOpacity
                  onPress={inviteUser}
                  style={styles.invite}
                >
                  <Text style={{ color: "#fff" }}>
                    Invite
                  </Text>
                </TouchableOpacity>
              ) : groupMode ? (
                <Text style={styles.check}>
                  {selected ? "✓" : ""}
                </Text>
              ) : (
                <Text style={styles.chat}>Chat</Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {groupMode && selectedUsers.length > 0 && (
        <TouchableOpacity
          style={styles.create}
          onPress={createGroup}
        >
          <Text style={{ color: "#000" }}>
            Create Group ({selectedUsers.length})
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  input: {
    backgroundColor: "#111",
    color: "#fff",
    margin: 10,
    padding: 12,
    borderRadius: 8,
  },

  row: {
    padding: 15,
    borderBottomWidth: 0.5,
    borderBottomColor: "#222",
    flexDirection: "row",
    justifyContent: "space-between",
  },

  selected: { backgroundColor: "#111" },

  name: { color: "#fff", fontSize: 16 },
  phone: { color: "#888", fontSize: 12 },

  onApp: { color: "#00ff88", fontSize: 12 },

  invite: {
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 6,
  },

  chat: { color: "#00ff88" },

  check: { color: "#00ff88", fontSize: 20 },

  create: {
    backgroundColor: "#00ff88",
    padding: 15,
    margin: 10,
    borderRadius: 10,
    alignItems: "center",
  },
});
