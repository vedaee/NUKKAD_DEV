import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";

import { launchImageLibrary } from "react-native-image-picker";

import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

export default function UserProfileScreen({ route }) {

  const { user } = route.params;

  const [uploading, setUploading] = useState(false);
  const [userData, setUserData] = useState(null);

  // ---------------------------------
  // FETCH USER DATA FROM FIRESTORE
  // ---------------------------------
  useEffect(() => {

    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((doc) => {

        if (doc.exists) {
          setUserData(doc.data());
        }

      });

    return () => unsubscribe();

  }, []);

  // ---------------------------------
  // CHANGE PROFILE PHOTO
  // ---------------------------------
  const changeDP = async () => {

    const result = await launchImageLibrary({
      mediaType: "photo",
      quality: 0.7,
    });

    if (result.didCancel) return;

    const asset = result.assets[0];

    try {

      setUploading(true);

      const ref = storage().ref(`profilePics/${user.uid}.jpg`);

      await ref.putFile(asset.uri);

      const downloadURL = await ref.getDownloadURL();

      await firestore()
        .collection("users")
        .doc(user.uid)
        .update({
          profilePic: downloadURL,
        });

      Alert.alert("Success", "Profile picture updated");

      setUploading(false);

    } catch (error) {

      console.log(error);
      Alert.alert("Error", "Failed to upload image");
      setUploading(false);

    }

  };

  return (
    <View style={styles.container}>

      {/* Avatar */}
      <TouchableOpacity onPress={changeDP}>
        <Image
          source={{
            uri:
              userData?.profilePic ||
              "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          }}
          style={styles.avatar}
        />
      </TouchableOpacity>

      {/* Change Photo Button */}
      <TouchableOpacity style={styles.button} onPress={changeDP}>
        <Text style={styles.buttonText}>Change Profile Photo</Text>
      </TouchableOpacity>

      {/* User Name */}
      <Text style={styles.name}>
        {userData?.name || "NUKKAD User"}
      </Text>

      {/* Phone Number */}
      <Text style={styles.phone}>
        {userData?.phone}
      </Text>

      {/* Uploading Status */}
      {uploading && (
        <Text style={styles.uploading}>Uploading...</Text>
      )}

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    paddingTop: 40,
  },

  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "#00ff88",
  },

  button: {
    marginTop: 15,
    backgroundColor: "#00ff88",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },

  buttonText: {
    color: "#000",
    fontWeight: "bold",
  },

  name: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 20,
  },

  phone: {
    fontSize: 16,
    color: "#ccc",
    marginTop: 5,
  },

  uploading: {
    marginTop: 15,
    color: "#00ff88",
    fontWeight: "bold",
  },

});
