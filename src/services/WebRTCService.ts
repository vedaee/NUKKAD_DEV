import {
  RTCPeerConnection,
  mediaDevices,
  MediaStream,
  RTCIceCandidate,
  RTCSessionDescription,
} from "react-native-webrtc";
import firestore from "@react-native-firebase/firestore";

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;

let callSnapshotUnsub: (() => void) | null = null;
let candidateSnapshotUnsub: (() => void) | null = null;

const configuration = {
  iceServers: [
    {
      urls: [
        "stun:nukkad.vemeet.online:3479",
        "stun:stun.l.google.com:19302",
      ],
    },
    {
      urls: "turn:nukkad.vemeet.online:3479",
      username: "nukkad",
      credential: "MyTurnPass@2025",
    },
  ],
  iceCandidatePoolSize: 10,
};

export const createPeer = async (
  callId?: string,
  isCaller: boolean = false,
  type: "audio" | "video" = "audio",
  onRemoteStream?: (stream: MediaStream) => void
) => {
  // 🔴 ALWAYS reset previous connection
  closeConnection();

  peerConnection = new RTCPeerConnection(configuration);

  // GET LOCAL MEDIA
  const constraints =
    type === "video"
      ? { audio: true, video: { facingMode: "user", width: 640, height: 480, frameRate: 30 } }
      : { audio: true, video: false };

  localStream = await mediaDevices.getUserMedia(constraints);

  // ADD TRACKS TO PEER
  localStream.getTracks().forEach(track => {
    peerConnection!.addTrack(track, localStream!);
  });

  // REMOTE STREAM
  peerConnection.ontrack = event => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
      console.log("REMOTE STREAM RECEIVED");
      if (onRemoteStream) onRemoteStream(remoteStream);
    }
  };

  if (!callId) return { peerConnection, localStream, remoteStream };

  const callDoc = firestore().collection("calls").doc(callId);
  const callerCandidates = callDoc.collection("callerCandidates");
  const calleeCandidates = callDoc.collection("calleeCandidates");

  // ICE CANDIDATES
  peerConnection.onicecandidate = async event => {
    if (!event.candidate) return;
    const data = event.candidate.toJSON();
    try {
      if (isCaller) await callerCandidates.add(data);
      else await calleeCandidates.add(data);
    } catch (err) {
      console.log("ICE write error", err);
    }
  };

  // LISTEN REMOTE ICE
  const candidateCollection = isCaller ? calleeCandidates : callerCandidates;
  candidateSnapshotUnsub = candidateCollection.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type !== "added") return;
      try {
        const candidate = new RTCIceCandidate(change.doc.data());
        peerConnection?.addIceCandidate(candidate);
      } catch (err) {
        console.log("ICE add error", err);
      }
    });
  });

  // RECEIVER HANDLES OFFER
  if (!isCaller) {
    callSnapshotUnsub = callDoc.onSnapshot(async snapshot => {
      const data = snapshot.data();
      if (!data || !data.offer) return;
      if (peerConnection?.remoteDescription) return;

      try {
        console.log("Receiver got offer");
        const offerDesc = new RTCSessionDescription(data.offer);
        await peerConnection?.setRemoteDescription(offerDesc);

        const answer = await peerConnection!.createAnswer();
        await peerConnection!.setLocalDescription(answer);

        await callDoc.update({
          answer: { type: answer.type, sdp: answer.sdp },
          status: "accepted",
        });

        console.log("Answer sent");
      } catch (err) {
        console.log("Answer error", err);
      }
    });
  }

  // ✅ ONLY ADDITION → CALLER LISTENS FOR ANSWER
  // ✅ FIXED CALLER ANSWER LISTENER
if (isCaller) {
  callSnapshotUnsub = callDoc.onSnapshot(async snapshot => {
    const data = snapshot.data();
    if (!data || !data.answer) return;

    try {
      // ✅ Prevent duplicate apply
      if (peerConnection?.currentRemoteDescription) return;

      console.log("🔥 Caller received answer → applying");

      const answerDesc = new RTCSessionDescription(data.answer);

      await peerConnection?.setRemoteDescription(answerDesc);

      console.log("✅ Caller connection established");

    } catch (err) {
      console.log("❌ Answer apply error", err);
    }
  });
}


  return { peerConnection, localStream, remoteStream };
};

export const getPeer = () => peerConnection;
export const getLocalStream = () => localStream;
export const getRemoteStream = () => remoteStream;

export const closeConnection = () => {
  try {
    if (peerConnection) {
      peerConnection.getSenders().forEach(sender => {
        try { peerConnection?.removeTrack(sender); } catch {}
      });
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.close();
      peerConnection = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream.release?.();
      localStream = null;
    }

    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
      remoteStream.release?.();
      remoteStream = null;
    }

    if (callSnapshotUnsub) { callSnapshotUnsub(); callSnapshotUnsub = null; }
    if (candidateSnapshotUnsub) { candidateSnapshotUnsub(); candidateSnapshotUnsub = null; }

    console.log("WEBRTC CONNECTION CLEANED");

  } catch (err) {
    console.log("Cleanup error", err);
  }
};
