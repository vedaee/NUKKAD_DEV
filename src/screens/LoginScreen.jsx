// src/screens/LoginScreen.jsx

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import messaging from "@react-native-firebase/messaging";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [loading, setLoading] = useState(false);

  // -------------------------------
  // NORMALIZE PHONE
  // -------------------------------
  const normalizePhone = (phone) => {
    if (!phone) return "";

    let cleaned = phone.replace(/\D/g, "");

    if (cleaned.startsWith("0")) {
      cleaned = cleaned.substring(1);
    }

    if (cleaned.length === 10) {
      cleaned = "91" + cleaned;
    }

    return "+" + cleaned;
  };

  // -------------------------------
  // SAVE FCM TOKEN (RETRY FIX)
  // -------------------------------
  const saveFCMToken = async (uid) => {
    try {
      console.log("🔥 FCM START");

      await messaging().registerDeviceForRemoteMessages();

      let token = null;

      for (let i = 0; i < 3; i++) {
        try {
          token = await messaging().getToken();
          if (token) break;
        } catch (e) {
          console.log("🔁 RETRY FCM:", i);
        }
      }

      console.log("📲 FINAL TOKEN:", token);

      if (!token) {
        console.log("❌ TOKEN NOT AVAILABLE");
        return;
      }

      await firestore()
        .collection("users")
        .doc(uid)
        .set(
          {
            fcmToken: token,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      console.log("✅ FCM TOKEN SAVED");
    } catch (err) {
      console.log("❌ FCM ERROR:", err);
    }
  };

  // -------------------------------
  // SEND OTP
  // -------------------------------
  const sendOtp = async () => {
    if (!phone) {
      Alert.alert("Error", "Enter phone number");
      return;
    }

    try {
      setLoading(true);

      const formattedPhone = normalizePhone(phone);

      console.log("📞 SENDING OTP TO:", formattedPhone);

      const confirmation = await auth().signInWithPhoneNumber(
        formattedPhone
      );

      setConfirm(confirmation);
    } catch (err) {
      console.log("❌ OTP ERROR:", err);
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // VERIFY OTP
  // -------------------------------
  const verifyOtp = async () => {
    if (!otp || !confirm) {
      Alert.alert("Error", "Enter OTP");
      return;
    }

    try {
      setLoading(true);

      const userCredential = await confirm.confirm(otp);
      const user = userCredential.user;

      await auth().currentUser.reload();

      console.log("✅ LOGIN SUCCESS:", user.uid);

      const userRef = firestore().collection("users").doc(user.uid);

      const doc = await userRef.get();

      const normalizedPhone = normalizePhone(user.phoneNumber);

      if (!doc.exists) {
        console.log("🆕 NEW USER");

        await userRef.set({
          uid: user.uid,
          phone: normalizedPhone.replace("+91", ""), // 10 digit
          phoneRaw: normalizedPhone,
          name: "NUKKAD User",
          profilePic: "https://i.pravatar.cc/300",
          isOnline: true,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        console.log("♻️ EXISTING USER UPDATE");

        await userRef.set(
          {
            phone: normalizedPhone.replace("+91", ""),
            phoneRaw: normalizedPhone,
            profilePic: "https://i.pravatar.cc/300", // ✅ ADD THIS
            isOnline: true,
            lastSeen: firestore.FieldValue.serverTimestamp(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // 🔥 FORCE FIX missing createdAt
        if (!doc.data()?.createdAt) {
          await userRef.set(
            {
              createdAt: firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      console.log("🔥 FIRESTORE USER SAVED");

      // -------------------------------
      // SAVE FCM TOKEN
      // -------------------------------
      await saveFCMToken(user.uid);

      setConfirm(null);

    } catch (err) {
      console.log("❌ VERIFY ERROR:", err);
      Alert.alert("Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------
  // UI
  // -------------------------------
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#000" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* LOGO */}
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
        />

        <Text style={styles.title}>NUKKAD</Text>

        {!confirm ? (
          <>
            <Text style={styles.subtitle}>
              Enter your phone number
            </Text>

            <TextInput
              placeholder="+91XXXXXXXXXX"
              placeholderTextColor="#888"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={sendOtp}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Enter OTP sent to your number
            </Text>

            <TextInput
              placeholder="Enter OTP"
              placeholderTextColor="#888"
              value={otp}
              onChangeText={setOtp}
              style={styles.input}
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={styles.button}
              onPress={verifyOtp}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// -------------------------------
// STYLES
// -------------------------------
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  logo: {
    width: 130,
    height: 130,
    marginBottom: 20,
    resizeMode: "contain",
  },

  title: {
    color: "#00ff88",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
  },

  subtitle: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 20,
  },

  input: {
    width: "85%",
    backgroundColor: "#111",
    color: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 15,
    textAlign: "center",
    fontSize: 16,
  },

  button: {
    width: "85%",
    backgroundColor: "#00ff88",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },

  buttonText: {
    color: "#000",
    fontWeight: "bold",
    fontSize: 16,
  },
});
