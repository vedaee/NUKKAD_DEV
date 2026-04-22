// src/screens/CallScreen.tsx

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  Image,
  Modal,
} from "react-native";

import InCallManager from "react-native-incall-manager";
import { RTCView, mediaDevices } from "react-native-webrtc";
import firestore from "@react-native-firebase/firestore";

import DocumentPicker from "react-native-document-picker";

import {
  createPeer,
  getPeer,
  getLocalStream,
  getRemoteStream,
  closeConnection,
} from "../services/WebRTCService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function CallScreen({ route, navigation }: any) {
  const {
    callId = "",
    callerName = "",
    callerNumber = "",
    calleeName = "",
    calleeNumber = "",
    isCaller = false,
    type = "audio",
  } = route.params || {};

  // State for call handling
  const [isLocalBig, setIsLocalBig] = useState(false);
  const [status, setStatus] = useState("Connecting...");
  const [callTime, setCallTime] = useState(0);

  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);

  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(type === "video");

  const [remoteActive, setRemoteActive] = useState(false);
  const [fullRemote, setFullRemote] = useState(true);

  const [showControls, setShowControls] = useState(true);
  const [sharing, setSharing] = useState(false);

  const [sharedFile, setSharedFile] = useState<any>(null);
  const [showSharedFull, setShowSharedFull] = useState(false);

  const [incomingCallVisible, setIncomingCallVisible] = useState(!isCaller);

  const peerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  const pan = useRef(
    new Animated.ValueXY({ x: SCREEN_WIDTH - 140, y: 40 })
  ).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: pan.x["_value"], y: pan.y["_value"] });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const xVal = pan.x._value;
        const yVal = pan.y._value;

        const isLeft = xVal < SCREEN_WIDTH / 2;
        const isTop = yVal < SCREEN_HEIGHT / 2;

        let newX = isLeft ? 20 : SCREEN_WIDTH - 140;
        let newY = isTop ? 40 : SCREEN_HEIGHT - 200;

        Animated.spring(pan, {
          toValue: { x: newX, y: newY },
          useNativeDriver: false,
          bounciness: 10,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    StatusBar.setTranslucent(true);
    StatusBar.setBackgroundColor("transparent");
    StatusBar.setBarStyle("light-content");
    return () => {
      StatusBar.setTranslucent(false);
      StatusBar.setBackgroundColor("#000");
    };
  }, []);

  useEffect(() => {
    let unsubscribe: any = () => {};

    const initCall = async () => {
      try {
        InCallManager.start({ media: videoEnabled ? "video" : "audio" });
        InCallManager.setForceSpeakerphoneOn(true);
        InCallManager.setSpeakerphoneOn(true);

        let peerConnection = getPeer();

        if (!peerConnection) {
          const streams = await createPeer(
            callId,
            isCaller,
            videoEnabled ? "video" : "audio",
            (remote: any) => {
              setRemoteStream(remote);
              setRemoteActive(true);
            }
          );

          peerConnection = streams.peerConnection;
          setLocalStream(streams.localStream);
        } else {
          setLocalStream(getLocalStream());
          const existingRemote = getRemoteStream();
          if (existingRemote) {
            setRemoteStream(existingRemote);
            setRemoteActive(true);
          }
        }

        peerRef.current = peerConnection;

        peerConnection.ontrack = (event: any) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
            setRemoteActive(true);
          }
        };

        unsubscribe = firestore()
          .collection("calls")
          .doc(callId)
          .onSnapshot((doc) => {
            const data = doc.data();
            if (!data) return;

            if (data.status === "ended") endCall();

            if (data.status === "accepted") {
              setStatus("Call in Progress");
              setIncomingCallVisible(false);
            }

            // RECEIVE SHARED FILE
            if (data.sharedFile) {
              setSharedFile(data.sharedFile);
              setSharing(true);
            }
          });

        intervalRef.current = setInterval(() => setCallTime((prev) => prev + 1), 1000);
        setStatus("Waiting for remote...");
      } catch (err) {
        console.log("Call init error:", err);
        Alert.alert("Call failed");
      }
    };

    initCall();

    const hideTimer = setTimeout(() => setShowControls(false), 4000);

    return () => {
      unsubscribe();
      clearInterval(intervalRef.current);
      clearTimeout(hideTimer);
      InCallManager.stop();
      closeConnection();
    };
  }, [callId]);

  // Accept/Reject Call Handlers
  const acceptCall = async () => {
    try {
      await firestore()
        .collection("calls")
        .doc(callId)
        .update({ status: "accepted" });
      setIncomingCallVisible(false);
    } catch (err) {
      console.log("Accept call error:", err);
    }
  };

  const rejectCall = async () => {
    try {
      await firestore()
        .collection("calls")
        .doc(callId)
        .update({ status: "ended" });
      setIncomingCallVisible(false);
      endCall();
    } catch (err) {
      console.log("Reject call error:", err);
    }
  };

  const endCall = () => {
    closeConnection();

    if (callId) {
      firestore()
        .collection("calls")
        .doc(callId)
        .update({ status: "ended" })
        .catch((err) => console.log("Failed to update call status", err));
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("ContactList");
    }
  };

  const toggleMute = () => {
    const stream = getLocalStream();
    if (!stream) return;
    stream.getAudioTracks().forEach((t: any) => (t.enabled = muted));
    setMuted(!muted);
  };

  const toggleSpeaker = () => {
    setSpeakerOn(!speakerOn);
    InCallManager.setSpeakerphoneOn(!speakerOn);
  };

  const flipCamera = () => {
    const stream = getLocalStream();
    if (!stream) return;
    stream.getVideoTracks().forEach((track: any) => track._switchCamera());
  };

  const switchVideo = async () => {
    const stream = await mediaDevices.getUserMedia({ video: true });
    const videoTrack = stream.getVideoTracks()[0];
    peerRef.current.getSenders().forEach((sender: any) => {
      if (sender.track && sender.track.kind === "video") sender.replaceTrack(videoTrack);
    });
    setVideoEnabled(true);
  };

  const shareScreen = async () => {
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.images, DocumentPicker.types.allFiles],
      });

      const file = res[0];
      setSharedFile(file);
      setSharing(true);

      // SEND FILE INFO TO OTHER PHONE
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
      if (!DocumentPicker.isCancel(err)) console.log("Share error:", err);
    }
  };

  const stopSharing = () => {
    setSharedFile(null);
    setSharing(false);
    setShowSharedFull(false);
  };

  const startConference = () => Alert.alert("Conference coming soon");
  const toggleFullRemote = () => setFullRemote(!fullRemote);
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const displayName = isCaller ? calleeName || callerName : callerName || calleeName;
  const displayNumber = isCaller ? calleeNumber || callerNumber : callerNumber || calleeNumber;

  return (
    <TouchableOpacity
      activeOpacity={1}
      style={styles.container}
      onPress={() => setShowControls(!showControls)}
    >
      {/* REMOTE VIDEO */}
      {fullRemote && (
        <>
          <RTCView
            key={isLocalBig ? localStream?.toURL() || "localFull" : remoteStream?.toURL() || "remoteFull"}
            streamURL={isLocalBig ? localStream?.toURL() : remoteStream?.toURL()}
            style={styles.remoteFull}
            objectFit="cover"
            zOrder={0}
            mirror={isLocalBig}
          />

          {/* LOCAL SMALL VIDEO */}
          {localStream && remoteStream && (
            <Animated.View
              style={[styles.localSmall, { transform: pan.getTranslateTransform(), zIndex: 10 }]}
              {...panResponder.panHandlers}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.9}
                onPress={() => setIsLocalBig(!isLocalBig)}
              >
                <RTCView
                  key={isLocalBig ? remoteStream?.toURL() || "remoteSmall" : localStream?.toURL() || "localSmall"}
                  streamURL={isLocalBig ? remoteStream?.toURL() : localStream?.toURL()}
                  style={{ width: "100%", height: "100%" }}
                  objectFit="cover"
                  zOrder={1}
                  mirror={!isLocalBig}
                />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* CALL INFO */}
          <View style={styles.info}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.number}>{displayNumber}</Text>
            <Text style={styles.timer}>{remoteActive ? formatTime(callTime) : status}</Text>
          </View>
        </>
      )}

      {/* INCOMING CALL FULLSCREEN ALERT */}
      <Modal visible={incomingCallVisible} transparent={true} animationType="slide">
        <View style={styles.incomingContainer}>
          <Text style={styles.incomingText}>{callerName || "NUKKAD User"} is calling...</Text>
          <View style={styles.incomingButtons}>
            <TouchableOpacity style={[styles.incomingButton, { backgroundColor: "green" }]} onPress={acceptCall}>
              <Text style={styles.incomingButtonText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.incomingButton, { backgroundColor: "red" }]} onPress={rejectCall}>
              <Text style={styles.incomingButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SHARED FILE PREVIEW */}
      {sharedFile && !showSharedFull && (
        <TouchableOpacity
          style={[styles.sharedPreview, { bottom: 200 }]}
          onPress={() => setShowSharedFull(true)}
        >
          {sharedFile.type?.includes("image") ? (
            <Image
              source={{ uri: sharedFile.uri }}
              style={{ width: 80, height: 80, borderRadius: 8 }}
            />
          ) : (
            <Text style={{ color: "#fff", fontSize: 12 }}>{sharedFile.name}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* FULLSCREEN SHARED FILE */}
      {sharedFile && showSharedFull && (
        <Modal transparent={true} animationType="fade">
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "#000" }}
            onPress={() => setShowSharedFull(false)}
            activeOpacity={1}
          >
            {sharedFile.type?.includes("image") ? (
              <Image
                source={{ uri: sharedFile.uri }}
                style={{ width: "100%", height: "100%", resizeMode: "contain" }}
              />
            ) : (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
                <Text style={{ color: "#fff", fontSize: 24 }}>{sharedFile.name}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Modal>
      )}

      {/* CONTROLS */}
      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.button} onPress={toggleMute}>
            <Text style={styles.icon}>{muted ? "🎤❌" : "🎤"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={toggleSpeaker}>
            <Text style={styles.icon}>{speakerOn ? "🔊" : "🔈"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={switchVideo}>
            <Text style={styles.icon}>🎥</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={flipCamera}>
            <Text style={styles.icon}>🔄</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={shareScreen}>
            <Text style={styles.icon}>📤</Text>
          </TouchableOpacity>

          {sharing && (
            <TouchableOpacity style={styles.button} onPress={stopSharing}>
              <Text style={styles.icon}>🛑</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.button} onPress={startConference}>
            <Text style={styles.icon}>👥</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={() =>
              navigation.navigate("Chat", {
                chatId: callId,
                userId: isCaller ? calleeNumber : callerNumber,
                userName: displayName,
                userPhone: isCaller ? calleeNumber : callerNumber,
                userPhoto: null,
                groupId: null,
                groupName: null,
                isGroup: false,
                returnToCall: true,
              })
            }
          >
            <Text style={styles.icon}>💬</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.end} onPress={endCall}>
            <Text style={styles.icon}>📞</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  remoteFull: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  remoteSmall: {
    position: "absolute",
    width: 120,
    height: 160,
    top: 40,
    right: 20,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    zIndex: 5,
    elevation: 5,
  },
  localFull: { position: "absolute", top: 0, left: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT, zIndex: 1 },
  localSmall: { position: "absolute", width: 120, height: 160, borderWidth: 2, borderColor: "#fff", borderRadius: 8 },
  info: { position: "absolute", top: 70, left: 20 },
  name: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  number: { color: "#fff", fontSize: 12 },
  timer: { color: "#0f0", fontSize: 12 },
  controls: {
    position: "absolute",
    bottom: 40,
    width: SCREEN_WIDTH,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
  },
  button: {
    backgroundColor: "#333",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    margin: 6,
  },
  end: {
    backgroundColor: "red",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    margin: 6,
  },
  icon: { fontSize: 24, color: "#fff" },
  sharedPreview: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "#222",
    padding: 5,
    borderRadius: 8,
    zIndex: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  incomingContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  incomingText: { color: "#fff", fontSize: 22, marginBottom: 20 },
  incomingButtons: { flexDirection: "row", justifyContent: "space-around", width: "80%" },
  incomingButton: {
    width: 120,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  incomingButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
