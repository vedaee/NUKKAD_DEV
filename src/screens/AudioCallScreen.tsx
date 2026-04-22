// src/screens/AudioCallScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import InCallManager from "react-native-incall-manager";

import { createPeer, getLocalStream, closeConnection } from "../services/WebRTCService";
import { getPeer } from "./WebRTCService";

export default function AudioCallScreen({ route, navigation }) {
  const { callId, callerName, calleeName, isCaller } = route.params;

  const [status, setStatus] = useState("Connecting...");
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [callTime, setCallTime] = useState(0);

  const peerRef = useRef(null);
  const timerRef = useRef<any>(null);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    let unsubscribe = () => {};

    const initCall = async () => {
      try {
        InCallManager.start({ media: "audio" });
        InCallManager.setSpeakerphoneOn(true);
        InCallManager.setForceSpeakerphoneOn(true);

        const { peerConnection } = await createPeer(callId, isCaller, "audio");
        peerRef.current = peerConnection;

        unsubscribe = firestore()
          .collection("calls")
          .doc(callId)
          .onSnapshot((doc) => {
            const data = doc.data();
            if (!data) return;

            if (data.status === "ended") {
              endCall();
            }

            if (data.status === "accepted") {
              setStatus("Call in Progress");
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }
          });

        setStatus("Waiting for remote...");

        timerRef.current = setInterval(() => {
          setCallTime((prev) => prev + 1);
        }, 1000);

        timeoutRef.current = setTimeout(() => {
          Alert.alert("No Answer");
          endCall();
        }, 30000);
      } catch (err) {
        console.log("Audio Call start error:", err);
        Alert.alert("Call failed");
      }
    };

    initCall();

    return () => {
      unsubscribe();
      clearInterval(timerRef.current);
      clearTimeout(timeoutRef.current);
      InCallManager.stop();
      closeConnection();
    };
  }, [callId]);

  /* ---------- SPEAKER ---------- */
  const toggleSpeaker = () => {
    const newState = !speakerOn;
    setSpeakerOn(newState);
    InCallManager.setSpeakerphoneOn(newState);
  };

  /* ---------- MUTE ---------- */
  const toggleMute = () => {
    const stream = getLocalStream();
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => (track.enabled = muted));
    setMuted(!muted);
  };

  /* ---------- END CALL ---------- */
  const endCall = async () => {
    try {
      await firestore().collection("calls").doc(callId).update({ status: "ended" });
    } catch (err) {
      console.log("End call error:", err);
    }
    InCallManager.stop();
    closeConnection();
    navigation.goBack();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const displayName = isCaller ? calleeName : callerName;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{displayName || "NUKKAD User"}</Text>
      <Text style={styles.timer}>{status === "Call in Progress" ? formatTime(callTime) : status}</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.circle} onPress={toggleMute}>
          <Text style={styles.icon}>{muted ? "🎤❌" : "🎤"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.circle} onPress={toggleSpeaker}>
          <Text style={styles.icon}>{speakerOn ? "🔊" : "🔈"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.end} onPress={endCall}>
          <Text style={styles.icon}>📞</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circle}
          onPress={() => navigation.replace("VideoCallScreen", { callId, callerName, calleeName, isCaller })}
        >
          <Text style={styles.icon}>🎥</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  title: { fontSize: 28, color: "#00ff88", fontWeight: "bold", marginBottom: 15 },
  timer: { fontSize: 22, color: "#00ff88", marginBottom: 40 },
  controls: { flexDirection: "row", justifyContent: "center", width: "100%" },
  circle: {
    backgroundColor: "#333",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    margin: 10
  },
  end: {
    backgroundColor: "red",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    margin: 10
  },
  icon: { fontSize: 24, color: "#fff" }
});
