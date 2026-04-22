// src/screens/VideoCallScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import InCallManager from "react-native-incall-manager";

import { RTCView, mediaDevices } from "react-native-webrtc";
import { createPeer, getLocalStream, getRemoteStream, closeConnection } from "../services/WebRTCService";
import { getPeer } from "./WebRTCService";

export default function VideoCallScreen({ route, navigation }) {
  const { callId, callerName, calleeName, isCaller } = route.params;

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [remoteActive, setRemoteActive] = useState(false);

  const peerRef = useRef<any>(null);

  const localStream = getLocalStream();
  const remoteStream = getRemoteStream();

  useEffect(() => {
    let unsubscribe = () => {};

    const initVideoCall = async () => {
      try {
        InCallManager.start({ media: "video" });
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);

        const { peerConnection } = await createPeer(callId, isCaller, "video");
        peerRef.current = peerConnection;

        peerConnection.ontrack = (event: any) => {
          if (event.streams && event.streams[0]) {
            setRemoteActive(true);
          }
        };

        unsubscribe = firestore()
          .collection("calls")
          .doc(callId)
          .onSnapshot((doc) => {
            const data = doc.data();
            if (!data) return;

            if (data.status === "ended") {
              endCall();
            }
          });
      } catch (err) {
        console.log("Video call init error:", err);
        Alert.alert("Call failed");
      }
    };

    initVideoCall();

    return () => {
      unsubscribe();
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

  /* ---------- FLIP CAMERA ---------- */
  const flipCamera = () => {
    const stream = getLocalStream();
    if (!stream) return;
    stream.getVideoTracks().forEach((track: any) => track._switchCamera());
  };

  /* ---------- SHARE SCREEN ---------- */
  const shareScreen = async () => {
    try {
      const screenStream = await mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const peer = peerRef.current;

      peer.getSenders().forEach((sender: any) => {
        if (sender.track.kind === "video") {
          sender.replaceTrack(screenTrack);
        }
      });
    } catch (err) {
      console.log("Screen share error:", err);
    }
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

  const displayName = isCaller ? calleeName : callerName;

  return (
    <View style={styles.container}>
      {remoteStream && remoteActive && videoEnabled && (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
      )}

      {localStream && videoEnabled && (
        <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" />
      )}

      <Text style={styles.name}>{displayName || "NUKKAD User"}</Text>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.circle} onPress={toggleMute}>
          <Text style={styles.icon}>{muted ? "🎤❌" : "🎤"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.circle} onPress={toggleSpeaker}>
          <Text style={styles.icon}>{speakerOn ? "🔊" : "🔈"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.circle} onPress={flipCamera}>
          <Text style={styles.icon}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.circle} onPress={shareScreen}>
          <Text style={styles.icon}>📺</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.end} onPress={endCall}>
          <Text style={styles.icon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  remoteVideo: { flex: 1, width: "100%", height: "100%" },
  localVideo: { position: "absolute", right: 20, top: 50, width: 120, height: 160, borderRadius: 8 },
  name: { position: "absolute", top: 30, alignSelf: "center", fontSize: 22, color: "#fff", fontWeight: "bold" },
  controls: { position: "absolute", bottom: 40, width: "100%", flexDirection: "row", justifyContent: "space-around" },
  circle: { backgroundColor: "#333", width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  end: { backgroundColor: "red", width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center" },
  icon: { fontSize: 24, color: "#fff" }
});
