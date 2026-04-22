// src/screens/StatusScreen.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  Modal,
  StyleSheet,
  Dimensions,
} from "react-native";

import { launchImageLibrary } from "react-native-image-picker";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import Video from "react-native-video";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import auth from "@react-native-firebase/auth";

const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;

export default function StatusScreen() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<{ [uid: string]: string }>({});
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // -----------------------------
  // FETCH STATUSES
  // -----------------------------
  useEffect(() => {
    const unsubscribe = firestore()
      .collection("statuses")
      // ⚠️ temporarily commented for debugging
      .orderBy("createdAt", "desc")
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            console.log("❌ Snapshot is null");
            setStatuses([]);
            return;
          }

          console.log("🔥 DOC COUNT:", snapshot.docs?.length);

          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          console.log("📊 STATUS DATA:", data);

          setStatuses(data);
        },
        (error) => {
          console.log("🚨 Status listener error:", error);
        }
      );

    return unsubscribe;
  }, []);

  // -----------------------------
  // FETCH USER NAMES
  // -----------------------------
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const uids = Array.from(
          new Set(statuses.map((s) => s?.uid).filter(Boolean))
        );

        if (uids.length === 0) return;

        const usersSnapshot = await firestore()
          .collection("users")
          .where(firestore.FieldPath.documentId(), "in", uids)
          .get();

        const namesMap: { [uid: string]: string } = {};

        usersSnapshot.docs.forEach((doc) => {
          namesMap[doc.id] = doc.data()?.name || "Unknown";
        });

        console.log("👤 USER MAP:", namesMap);

        setUserNames(namesMap);
      } catch (error) {
        console.log("🚨 Fetch names error:", error);
      }
    };

    fetchNames();
  }, [statuses]);

  // -----------------------------
  // UPLOAD STATUS
  // -----------------------------
  const uploadStatus = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: "mixed" });

      if (result.didCancel || !result.assets || !result.assets[0]) return;

      const asset = result.assets[0];

      if (!asset.uri) return;

      const ext = asset.fileName?.split(".").pop() || "jpg";
      const ref = storage().ref(`statuses/${Date.now()}.${ext}`);

      await ref.putFile(asset.uri);
      const url = await ref.getDownloadURL();

      console.log("📤 FILE URL:", url);

      const docRef = await firestore().collection("statuses").add({
        url,
        type: asset.type?.startsWith("video") ? "video" : "image",
        uid: auth().currentUser?.uid,
        createdAt: new Date(),
      });

      console.log("✅ STATUS SAVED:", docRef.id);

      Alert.alert("Success", "Status uploaded!");
    } catch (error) {
      console.log("❌ Upload Status Error:", error);
      Alert.alert("Error", "Failed to upload status");
    }
  };

  // -----------------------------
  // DELETE STATUS
  // -----------------------------
  const deleteStatus = (statusId: string) => {
    Alert.alert("Delete Status", "Do you want to delete this status?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await firestore().collection("statuses").doc(statusId).delete();
          } catch (error) {
            console.log("❌ Delete Error:", error);
          }
        },
      },
    ]);
  };

  const selectedStatus = statuses[selectedIndex];

  // -----------------------------
  // RENDER ITEM
  // -----------------------------
  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <TouchableOpacity
      style={styles.statusItem}
      onPress={() => {
        setSelectedIndex(index);
        setFullScreen(true);
      }}
    >
      {item?.type === "image" ? (
        <Image source={{ uri: item?.url }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnail}>
          <Video
            source={{ uri: item?.url }}
            style={styles.thumbnail}
            paused
            resizeMode="cover"
          />
          <Icon
            name="play-circle-outline"
            size={30}
            color="#fff"
            style={styles.playIcon}
          />
        </View>
      )}

      <Text style={styles.userName}>
        {userNames[item?.uid] || "Unknown"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000", padding: 10 }}>
      {/* Upload Button */}
      <TouchableOpacity style={styles.uploadBtn} onPress={uploadStatus}>
        <Icon name="plus" size={24} color="#000" />
        <Text style={{ marginLeft: 8, color: "#000", fontWeight: "bold" }}>
          Add Status
        </Text>
      </TouchableOpacity>

      {/* Status List */}
      <FlatList
        data={statuses}
        horizontal
        keyExtractor={(item) => item?.id || Math.random().toString()}
        renderItem={renderItem}
        style={{ marginTop: 15 }}
      />

      {/* Fullscreen Modal */}
      <Modal visible={fullScreen} transparent>
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setFullScreen(false)}
          >
            <Icon name="arrow-left" size={30} color="#fff" />
          </TouchableOpacity>

          {selectedStatus?.type === "image" ? (
            <Image
              source={{ uri: selectedStatus?.url }}
              style={styles.fullScreenImage}
            />
          ) : (
            <Video
              source={{ uri: selectedStatus?.url }}
              style={styles.fullScreenImage}
              controls
              resizeMode="contain"
            />
          )}

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteStatus(selectedStatus?.id)}
          >
            <Icon name="delete" size={30} color="#fff" />
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
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00ff88",
    padding: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusItem: {
    marginRight: 10,
    alignItems: "center",
  },
  thumbnail: {
    width: 80,
    height: 140,
    borderRadius: 8,
  },
  playIcon: {
    position: "absolute",
    top: 50,
    left: 25,
  },
  userName: {
    marginTop: 5,
    color: "#fff",
    fontSize: 12,
    textAlign: "center",
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight,
  },
  backBtn: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 10,
  },
  deleteBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
});
