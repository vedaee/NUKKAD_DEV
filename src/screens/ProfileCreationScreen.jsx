import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";

import storage from "@react-native-firebase/storage";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { launchImageLibrary } from "react-native-image-picker";

export default function ProfileCreationScreen({ route }) {
  const { currentUser, onProfileComplete } = route.params;

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.7,
    });

    if (!result.didCancel && result.assets?.length) {
      setPhoto(result.assets[0]);
    }
  };

  const saveProfile = async () => {
    if (!name) {
      Alert.alert("Enter your name");
      return;
    }

    try {
      setUploading(true);

      let photoURL = "";

      if (photo) {
        const ref = storage().ref(
          `profilePics/${currentUser.uid}.jpg`
        );
        await ref.putFile(photo.uri);
        photoURL = await ref.getDownloadURL();
      } else {
        photoURL = "https://i.pravatar.cc/300";
      }

      await firestore()
        .collection("users")
        .doc(currentUser.uid)
        .set(
          {
            uid: currentUser.uid,
            phone: currentUser.phoneNumber || "",
            name,
            profilePic: photoURL,
            isOnline: true,
            blocked: false,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      onProfileComplete(); // ✅ CORRECT
    } catch (err) {
      console.log("Profile Save Error:", err);
      Alert.alert("Error", err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/logo.png")}
        style={styles.logo}
      />

      <Text style={styles.title}>Complete Profile</Text>

      <TouchableOpacity onPress={pickImage}>
        <Image
          source={{
            uri: photo ? photo.uri : "https://i.pravatar.cc/300",
          }}
          style={styles.avatar}
        />
      </TouchableOpacity>

      <TextInput
        placeholder="Your Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
      />

      <TouchableOpacity
        style={[styles.button, uploading && { opacity: 0.6 }]}
        onPress={saveProfile}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Save Profile</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => auth().signOut()}
      >
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  logo: {
    width: 130,
    height: 130,
    marginBottom: 25,
    resizeMode: "contain",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    width: 260,
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#007bff",
    padding: 14,
    borderRadius: 10,
    width: 180,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  logoutButton: {
    marginTop: 15,
  },
  logoutText: {
    color: "red",
    fontWeight: "bold",
  },
});
