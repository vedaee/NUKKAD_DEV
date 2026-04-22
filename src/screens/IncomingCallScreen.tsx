// src/screens/IncomingCallScreen.tsx

import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from "react-native";
import firestore from "@react-native-firebase/firestore";
import SoundPlayer from "react-native-sound-player";
import { createPeer } from "../services/WebRTCService";
import { RTCSessionDescription } from "react-native-webrtc";

export default function IncomingCallScreen({ route, navigation }: any) {

  const { callId, callerName, callerNumber, type } = route.params;
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {

    startRingtone();

    const unsubscribe = firestore()
      .collection("calls")
      .doc(callId)
      .onSnapshot((doc) => {

        const data = doc.data();
        if (!data) return;

        if (data.status === "ended") {
          stopRingtone();
          navigation.goBack();
        }

      });

    return () => {
      stopRingtone();
      unsubscribe();
    };

  }, []);

  const startRingtone = () => {

    try {
      SoundPlayer.playSoundFile("call_ringtone", "mp3");
    } catch {}

    Vibration.vibrate([0, 1000, 1000], true);

  };

  const stopRingtone = () => {

    try {
      SoundPlayer.stop();
    } catch {}

    Vibration.cancel();

  };

  const acceptCall = async () => {

    if (accepting) return;

    setAccepting(true);

    try {

      const callDoc = firestore().collection("calls").doc(callId);
      const callData = (await callDoc.get()).data();

      if (!callData?.offer) return;

      // 🔹 Create peer only once here
      const { peerConnection } = await createPeer(callId, false, callData.type);

      // 🔹 Apply caller offer
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(callData.offer)
      );

      // 🔹 Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // 🔹 Send answer
      await callDoc.update({
        answer: {
          type: answer.type,
          sdp: answer.sdp
        },
        status: "accepted"
      });

      stopRingtone();

      navigation.replace("CallScreen", {
        callId,
        callerName,
        callerNumber,
        isCaller: false,
        type
      });

    } catch (err) {

      console.log("Accept error:", err);
      setAccepting(false);

    }

  };

  const declineCall = async () => {

    try {

      await firestore()
        .collection("calls")
        .doc(callId)
        .update({ status: "ended" });

    } catch {}

    stopRingtone();
    navigation.goBack();

  };

  return (

    <View style={styles.container}>

      <Text style={styles.title}>Incoming Call</Text>

      <Text style={styles.name}>
        {callerName || "NUKKAD User"}
      </Text>

      <View style={styles.buttons}>

        <TouchableOpacity
          style={styles.decline}
          onPress={declineCall}
        >
          <Text style={styles.text}>Decline</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.accept}
          onPress={acceptCall}
        >
          <Text style={styles.text}>Accept</Text>
        </TouchableOpacity>

      </View>

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
    fontSize:20,
    color:"#00ff88"
  },

  buttons:{
    flexDirection:"row",
    marginTop:40
  },

  decline:{
    backgroundColor:"red",
    padding:15,
    borderRadius:50,
    marginRight:20
  },

  accept:{
    backgroundColor:"green",
    padding:15,
    borderRadius:50
  },

  text:{
    color:"#fff",
    fontWeight:"bold"
  }

});
