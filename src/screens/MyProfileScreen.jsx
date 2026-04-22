// src/screens/MyProfileScreen.jsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { launchImageLibrary } from "react-native-image-picker";

export default function MyProfileScreen({ navigation }) {
  const currentUid = auth().currentUser?.uid;

  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newName, setNewName] = useState("");

  // -----------------------------
  // FETCH CURRENT USER DATA
  // -----------------------------
  useEffect(() => {
    if (!currentUid) return;

    const unsubscribe = firestore()
      .collection("users")
      .doc(currentUid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const data = doc.data();
          setUserData(data);
          setNewName(data.name || "");
        }
        setLoading(false);
      });

    return () => unsubscribe();
  }, [currentUid]);

  // -----------------------------
  // CHANGE PROFILE PHOTO
  // -----------------------------
  const changeProfilePhoto = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: "photo" });
      if (result.didCancel || !result.assets) return;

      const uri = result.assets[0].uri;
      const reference = storage().ref(`profilePhotos/${currentUid}/${Date.now()}.jpg`);

      setUpdating(true);
      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();

      await firestore().collection("users").doc(currentUid).update({
        profilePic: downloadURL,
      });

      setUpdating(false);
      Alert.alert("Success", "Profile photo updated!");
    } catch (err) {
      console.log("Profile Photo Error:", err);
      setUpdating(false);
      Alert.alert("Error", "Failed to update profile photo");
    }
  };

  // -----------------------------
  // CHANGE NAME
  // -----------------------------
  const changeName = async () => {
    if (!newName.trim()) return;

    try {
      setUpdating(true);
      await firestore().collection("users").doc(currentUid).update({
        name: newName.trim(),
      });
      setUpdating(false);
      Alert.alert("Success", "Name updated!");
    } catch (err) {
      console.log("Update Name Error:", err);
      setUpdating(false);
      Alert.alert("Error", "Failed to update name");
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ff88" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* PROFILE PHOTO */}
      <TouchableOpacity
        onPress={changeProfilePhoto}
        style={{ alignSelf: "center", marginVertical: 20 }}
      >
        <Image
          source={{ uri: userData.profilePic || "https://i.pravatar.cc/300" }}
          style={styles.profilePhoto}
        />
      </TouchableOpacity>

      {/* NAME INPUT */}
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Your Name</Text>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Enter your name"
          placeholderTextColor="#888"
        />
        
        <Text style={styles.phoneText}>
          {userData?.phone || "Phone not saved"}
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={changeName}>
          <Text style={styles.buttonText}>{updating ? "Updating..." : "Save Name"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// -----------------------------
// STYLES
// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  profilePhoto: { width: 120, height: 120, borderRadius: 60 },

  inputContainer: { marginTop: 30 },
  label: { color: "#fff", fontSize: 16, marginBottom: 8 },
  input: {
    backgroundColor: "#111",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
  },

  phoneText: {
    color: "#888",
    marginTop: 8,
    fontSize: 14,
  },

  button: {
    backgroundColor: "#00ff88",
    padding: 12,
    borderRadius: 8,
    marginTop: 15,
    alignItems: "center",
  },
  buttonText: { color: "#000", fontWeight: "bold" },
});


