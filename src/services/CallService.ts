// src/services/CallService.ts

import firestore from "@react-native-firebase/firestore";
import RNCallKeep from "react-native-callkeep";
import { getPeer, closeConnection } from "./WebRTCService";

type CallData = {
  callId: string;
  callerName: string;
  callerNumber?: string;
  calleeName: string;
  calleeNumber?: string;
  type: "audio" | "video";
  status: "calling" | "accepted" | "ended";
  sharedFile?: any;
};

export default class CallService {
  private static instance: CallService;
  private unsubscribe: any = null;

  static getInstance() {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  listenCall(callId: string, onUpdate: (data: CallData) => void) {
    if (!callId) return;

    this.unsubscribe = firestore()
      .collection("calls")
      .doc(callId)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (!data) return;

        onUpdate(data as CallData);

        // Handle CallKeep incoming call for lock screen
        if (data.status === "calling") {
          RNCallKeep.displayIncomingCall(
            data.callId,
            data.callerName,
            data.callerNumber || "",
            true
          );
        }
      });
  }

  stopListening() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  async startCall(callData: CallData) {
    try {
      await firestore().collection("calls").doc(callData.callId).set(callData);
      RNCallKeep.startCall(callData.callId, callData.calleeNumber || "", callData.calleeName);
    } catch (err) {
      console.log("Start call error:", err);
    }
  }

  async acceptCall(callId: string) {
    try {
      await firestore().collection("calls").doc(callId).update({ status: "accepted" });
      RNCallKeep.answerIncomingCall(callId);
    } catch (err) {
      console.log("Accept call error:", err);
    }
  }

  async rejectCall(callId: string) {
    try {
      await firestore().collection("calls").doc(callId).update({ status: "ended" });
      RNCallKeep.endCall(callId);
      closeConnection();
    } catch (err) {
      console.log("Reject call error:", err);
    }
  }

  async endCall(callId: string) {
    try {
      await firestore().collection("calls").doc(callId).update({ status: "ended" });
      RNCallKeep.endCall(callId);
      closeConnection();
    } catch (err) {
      console.log("End call error:", err);
    }
  }

  async shareFile(callId: string, file: any) {
    try {
      await firestore()
        .collection("calls")
        .doc(callId)
        .update({
          sharedFile: {
            uri: file.uri,
            name: file.name,
            type: file.type || "",
          },
        });
    } catch (err) {
      console.log("Share file error:", err);
    }
  }

  async stopSharing(callId: string) {
    try {
      await firestore().collection("calls").doc(callId).update({ sharedFile: null });
    } catch (err) {
      console.log("Stop sharing error:", err);
    }
  }

  async cleanupCall(callId: string) {
    try {
      closeConnection();
      this.stopListening();
      await firestore().collection("calls").doc(callId).update({ status: "ended" });
      RNCallKeep.endCall(callId);
    } catch (err) {
      console.log("Cleanup call error:", err);
    }
  }

  async toggleMute(localStream: any, muted: boolean) {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t: any) => (t.enabled = muted));
  }

  async toggleSpeaker(on: boolean) {
    RNCallKeep.setActive(on);
  }

  async switchCamera(localStream: any) {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((track: any) => track._switchCamera());
  }

  async switchVideoTrack(localStream: any, peerConnection: any) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const videoTrack = stream.getVideoTracks()[0];
    peerConnection.getSenders().forEach((sender: any) => {
      if (sender.track && sender.track.kind === "video") sender.replaceTrack(videoTrack);
    });
  }

  async startConference() {
    Alert.alert("Conference feature coming soon");
  }

  formatCallTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }
}
