// src/screens/OutgoingCallScreen.tsx

import React, { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import firestore from "@react-native-firebase/firestore";
import SoundPlayer from "react-native-sound-player";
import { createPeer } from "../services/WebRTCService";
import { RTCSessionDescription } from "react-native-webrtc";

export default function OutgoingCallScreen({ route, navigation }: any) {

  const {
    callId,
    calleeName,
    calleeNumber,
    callerName,
    callerNumber,
    type
  } = route.params;

  const [timer, setTimer] = useState(0);
  const [connecting, setConnecting] = useState(true);

  const intervalRef = useRef<any>(null);
  const peerRef = useRef<any>(null);

  useEffect(() => {

    startCall();

    try {
      SoundPlayer.playSoundFile("beep_beep", "mp3");
    } catch {}

    intervalRef.current = setInterval(() => {
      setTimer(t => t + 1);
    }, 1000);

    return () => {
      clearInterval(intervalRef.current);
      SoundPlayer.stop();
    };

  }, []);

  const startCall = async () => {

    try {

      const callDoc = firestore().collection("calls").doc(callId);

      const { peerConnection } = await createPeer(callId, true, type);
      peerRef.current = peerConnection;

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await callDoc.set(
        {
          offer: {
            type: offer.type,
            sdp: offer.sdp
          },
          status: "calling",
          type: type || "audio",
          callerName: callerName || "NUKKAD User",
          callerNumber: callerNumber || "",
          calleeName: calleeName || "NUKKAD User",
          calleeNumber: calleeNumber || "",
          createdAt: firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      callDoc.onSnapshot(async (snapshot) => {

        const data = snapshot.data();
        if (!data) return;

        // ANSWER RECEIVED
if (data.answer && connecting) {

  console.log("ANSWER RECEIVED:", data.answer);

  setConnecting(false); // ✅ prevents multiple triggers

  SoundPlayer.stop();

  navigation.replace("CallScreen", {
    callId,
    callerName,
    callerNumber,
    calleeName,
    calleeNumber,
    isCaller: true,
    type
  });

}


        // CALL ENDED
        if (data.status === "ended") {

          SoundPlayer.stop();
          navigation.goBack();

        }

      });

    } catch (err) {

      console.log("Start call error:", err);

    }

  };

  const endCall = async () => {

    try {

      await firestore()
        .collection("calls")
        .doc(callId)
        .update({ status: "ended" });

    } catch {}

    SoundPlayer.stop();
    navigation.goBack();

  };

  const formatTimer = (sec: number) => {

    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");

    return `${m}:${s}`;

  };

  return (

    <View style={styles.container}>

      <Text style={styles.title}>
        {connecting ? "Calling..." : "Connecting..."}
      </Text>

      <Text style={styles.name}>
        {calleeName || "NUKKAD User"}
      </Text>

      <Text style={styles.number}>
        {calleeNumber || ""}
      </Text>

      <Text style={styles.callerInfo}>
        Caller: {callerName || "NUKKAD User"} ({callerNumber || ""})
      </Text>

      <Text style={styles.timer}>
        {formatTimer(timer)}
      </Text>

      <TouchableOpacity
        style={styles.end}
        onPress={endCall}
      >
        <Text style={styles.text}>Cancel</Text>
      </TouchableOpacity>

    </View>

  );

}

const styles = StyleSheet.create({

  container:{
    flex:1,
    justifyContent:"center",
    alignItems:"center",
    backgroundColor:"#121212"
  },

  title:{
    fontSize:22,
    color:"#fff",
    marginBottom:10
  },

  name:{
    fontSize:22,
    color:"#00ff88"
  },

  number:{
    fontSize:18,
    color:"#fff",
    marginBottom:5
  },

  callerInfo:{
    fontSize:16,
    color:"#aaa",
    marginBottom:15
  },

  timer:{
    fontSize:18,
    color:"#00ff88",
    marginBottom:30
  },

  end:{
    marginTop:20,
    backgroundColor:"red",
    padding:15,
    borderRadius:50
  },

  text:{
    color:"#fff",
    fontWeight:"bold"
  }

});
