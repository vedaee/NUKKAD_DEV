// src/screens/GroupInfoScreen.jsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { launchImageLibrary } from "react-native-image-picker";
import storage from "@react-native-firebase/storage";

export default function GroupInfoScreen({ route, navigation }) {
  const { groupId } = route.params;
  const currentUid = auth().currentUser?.uid;

  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [adminId, setAdminId] = useState(null);
  const [groupData, setGroupData] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // -----------------------------
  // FETCH GROUP INFO
  // -----------------------------
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("groups")
      .doc(groupId)
      .onSnapshot(async (doc) => {
        if (!doc.exists) return;

        const data = doc.data();
        setGroupData(data);
        setAdminId(data.adminId || data.participants[0]); // first member as default admin

        const memberDocs = await Promise.all(
          (data.participants || []).map((uid) =>
            firestore().collection("users").doc(uid).get()
          )
        );

        const memberData = memberDocs.map((d) => ({
          uid: d.id,
          name: d.data()?.name || "Unknown",
          profilePic: d.data()?.profilePic || null,
        }));

        setMembers(memberData);
        setLoading(false);
      });

    return () => unsubscribe();
  }, [groupId]);

  // -----------------------------
  // FETCH ALL USERS FOR ADDING
  // -----------------------------
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("users")
      .onSnapshot((snapshot) => {
        const users = snapshot.docs
          .map((d) => ({
            uid: d.id,
            name: d.data()?.name || "Unknown",
            profilePic: d.data()?.profilePic || null,
          }))
          .filter((u) => !members.find((m) => m.uid === u.uid)); // exclude current members
        setAllUsers(users);
      });

    return () => unsubscribe();
  }, [members]);

  // -----------------------------
  // CHANGE GROUP PHOTO
  // -----------------------------
  const changeGroupPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: "photo" });
    if (result.didCancel || !result.assets) return;

    const uri = result.assets[0].uri;
    const reference = storage().ref(`groupPhotos/${groupId}/${Date.now()}.jpg`);

    await reference.putFile(uri);
    const downloadURL = await reference.getDownloadURL();

    await firestore().collection("groups").doc(groupId).update({
      groupPhoto: downloadURL,
    });
  };

  // -----------------------------
  // CHANGE GROUP NAME
  // -----------------------------
  const changeGroupName = () => {
    Alert.prompt(
      "Change Group Name",
      "Enter new group name",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: async (name) => {
            if (!name.trim()) return;
            await firestore().collection("groups").doc(groupId).update({
              name: name.trim(),
            });
          },
        },
      ],
      "plain-text",
      groupData.name || ""
    );
  };

  // -----------------------------
  // REMOVE MEMBER (Admin Only)
  // -----------------------------
  const removeMember = async (uid) => {
    if (currentUid !== adminId) {
      Alert.alert("Permission Denied", "Only admin can remove members");
      return;
    }

    Alert.alert(
      "Remove Member",
      "Are you sure you want to remove this member?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await firestore()
                .collection("groups")
                .doc(groupId)
                .update({
                  participants: firestore.FieldValue.arrayRemove(uid),
                });

              if (uid === adminId) {
                const remaining = members.filter((m) => m.uid !== uid);
                if (remaining.length > 0) {
                  await firestore()
                    .collection("groups")
                    .doc(groupId)
                    .update({
                      adminId: remaining[0].uid,
                    });
                }
              }
            } catch (err) {
              console.log("Remove Member Error:", err);
              Alert.alert("Error", "Failed to remove member");
            }
          },
        },
      ]
    );
  };

  // -----------------------------
  // MAKE MEMBER ADMIN
  // -----------------------------
  const makeAdmin = async (uid) => {
    if (currentUid !== adminId) {
      Alert.alert("Permission Denied", "Only admin can assign admin");
      return;
    }

    Alert.alert(
      "Make Admin",
      "Do you want to make this member an admin?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              await firestore()
                .collection("groups")
                .doc(groupId)
                .update({ adminId: uid });
            } catch (err) {
              console.log("Make Admin Error:", err);
              Alert.alert("Error", "Failed to make admin");
            }
          },
        },
      ]
    );
  };

  // -----------------------------
  // ADD MEMBERS (inline modal)
  // -----------------------------
  const addMember = async (uid) => {
    try {
      await firestore().collection("groups").doc(groupId).update({
        participants: firestore.FieldValue.arrayUnion(uid),
      });
      setModalVisible(false);
    } catch (err) {
      console.log("Add Member Error:", err);
      Alert.alert("Error", "Failed to add member");
    }
  };

  // -----------------------------
  // EXIT GROUP
  // -----------------------------
  const exitGroup = async () => {
    Alert.alert(
      "Exit Group",
      "Are you sure you want to exit this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: async () => {
            try {
              await firestore()
                .collection("groups")
                .doc(groupId)
                .update({
                  participants: firestore.FieldValue.arrayRemove(currentUid),
                });

              if (currentUid === adminId) {
                const remaining = members.filter((m) => m.uid !== currentUid);
                if (remaining.length > 0) {
                  await firestore()
                    .collection("groups")
                    .doc(groupId)
                    .update({ adminId: remaining[0].uid });
                }
              }

              navigation.goBack();
            } catch (err) {
              console.log("Exit Group Error:", err);
              Alert.alert("Error", "Exit failed");
            }
          },
        },
      ]
    );
  };

  // -----------------------------
  // RENDER MEMBER
  // -----------------------------
  const renderMember = ({ item }) => (
    <View style={styles.memberRow}>
      <Image
        source={{ uri: item.profilePic || "https://i.pravatar.cc/150" }}
        style={styles.avatar}
      />
      <Text style={styles.memberName}>{item.name}</Text>

      {currentUid === adminId && item.uid !== currentUid && (
        <View style={{ flexDirection: "row", marginLeft: "auto" }}>
          <TouchableOpacity
            onPress={() => removeMember(item.uid)}
            style={{ marginRight: 10 }}
          >
            <Text style={{ color: "red" }}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => makeAdmin(item.uid)}>
            <Text style={{ color: "#00ff88" }}>Make Admin</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.uid === adminId && (
        <Text style={{ marginLeft: 8, color: "#00ff88" }}>Admin</Text>
      )}
    </View>
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
      {/* GROUP PHOTO */}
      <TouchableOpacity
        onPress={changeGroupPhoto}
        style={{ alignSelf: "center", marginVertical: 20 }}
      >
        <Image
          source={{
            uri: groupData.groupPhoto || "https://i.pravatar.cc/300",
          }}
          style={styles.groupPhoto}
        />
      </TouchableOpacity>

      {/* GROUP NAME */}
      <TouchableOpacity
        onPress={changeGroupName}
        style={styles.groupNameContainer}
      >
        <Text style={styles.groupName}>{groupData.name || "Group"}</Text>
      </TouchableOpacity>

      {/* ADD MEMBERS */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.buttonText}>Add Members</Text>
      </TouchableOpacity>

      {/* EXIT GROUP */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "red" }]}
        onPress={exitGroup}
      >
        <Text style={styles.buttonText}>Exit Group</Text>
      </TouchableOpacity>

      {/* MEMBERS LIST */}
      <Text style={styles.membersTitle}>Members</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.uid}
        renderItem={renderMember}
      />

      {/* ADD MEMBERS MODAL */}
      <Modal visible={modalVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#000", padding: 15 }}>
          <Text
            style={{
              color: "#fff",
              fontSize: 18,
              fontWeight: "bold",
              marginBottom: 10,
            }}
          >
            Select Members to Add
          </Text>

          <ScrollView>
            {allUsers.map((user) => (
              <TouchableOpacity
                key={user.uid}
                style={styles.memberRow}
                onPress={() => addMember(user.uid)}
              >
                <Image
                  source={{
                    uri: user.profilePic || "https://i.pravatar.cc/150",
                  }}
                  style={styles.avatar}
                />
                <Text style={styles.memberName}>{user.name}</Text>
                <Text style={{ marginLeft: "auto", color: "#00ff88" }}>Add</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            style={[styles.button, { marginTop: 20 }]}
            onPress={() => setModalVisible(false)}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

// -----------------------------
// STYLES
// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 15 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  groupPhoto: { width: 120, height: 120, borderRadius: 60 },
  groupNameContainer: {
    marginVertical: 10,
    alignSelf: "center",
  },
  groupName: { fontSize: 22, fontWeight: "bold", color: "#fff" },

  button: {
    backgroundColor: "#00ff88",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    alignItems: "center",
  },
  buttonText: { color: "#000", fontWeight: "bold" },

  membersTitle: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: "#222",
    borderBottomWidth: 0.5,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  memberName: { color: "#fff", marginLeft: 10, fontSize: 16 },
});
