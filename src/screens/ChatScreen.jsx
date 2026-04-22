// 1749chatscreen 
// src/screens/ChatScreen.jsx

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  Modal,
  Alert,
  Linking,
} from "react-native";

import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { PermissionsAndroid } from "react-native";
import RNFS from "react-native-fs";
import { LANGUAGES } from "../utils/languages";
import MessageActionModal from "../components/MessageActionModal";
import Contacts from "react-native-contacts";

import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { launchImageLibrary } from "react-native-image-picker";
import AudioRecorderPlayer from "react-native-audio-recorder-player";
import Video from "react-native-video";
import axios from "axios";

console.log("FIRESTORE APP NAME:", firestore().app.name);
console.log("FIRESTORE PROJECT ID:", firestore().app.options.projectId);
console.log("FIRESTORE APP OPTIONS:", firestore().app.options);

export default function ChatScreen({ route, navigation }) {
  const currentUser = auth().currentUser;
  const currentUid = currentUser?.uid;

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user) => {
      if (user) {
        console.log("Signed in user detected:", user.uid);
        // Ensure user document exists in Firestore
        const userRef = firestore().collection("users").doc(user.uid);
        const doc = await userRef.get();
        if (!doc.exists) {
          await userRef.set({
            uid: user.uid,
            phone: user.phoneNumber || "",
            name: user.displayName || "",
            isOnline: true,
            lastSeen: firestore.FieldValue.serverTimestamp(),
            createdAt: firestore.FieldValue.serverTimestamp(),
          });
          console.log("User document created in Firestore!");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // ==============================
// LOAD PHONE CONTACTS
// ==============================
useEffect(() => {

  const loadContacts = async () => {

    try {

      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS
      );

      if (permission === PermissionsAndroid.RESULTS.GRANTED) {

        const phoneContacts = await Contacts.getAll();

        setContacts(phoneContacts);

        console.log("Contacts loaded:", phoneContacts.length);

      }

    } catch (error) {

      console.log("Contacts error:", error);

    }

  };

  loadContacts();

}, []);

  const {
    chatId: routeChatId,
    userId,
    userName,
    userPhoto,
    userPhone,
    groupId,
    groupName,
    isGroup,
  } = route.params || {};

  if (!currentUser) return null;

  const chatId = isGroup
    ? groupId
    : routeChatId || [currentUser.uid, userId].sort().join("_");

  if (!chatId) return null;

  const [otherUserData, setOtherUserData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [myUserData, setMyUserData] = useState(null);

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [emojiVisible, setEmojiVisible] = useState(false);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  
  // ==============================
  // GET CONTACT NAME FROM PHONE
  // ==============================
  const getContactName = (phone) => {

    if (!phone || contacts.length === 0) return null;

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    const match = contacts.find(c =>
      c.phoneNumbers?.some(p =>
        p.number.replace(/\D/g, "").slice(-10) === cleanPhone
      )
    );

    return match ? match.displayName : null;
  };

  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState("00:00");
  const [replyMessage, setReplyMessage] = useState(null);
  const [pinnedMessage, setPinnedMessage] = useState(null);

  const [showTranslateMenu, setShowTranslateMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);

  // ==============================
  // Ensure a user exists in Firestore (auto-create for test numbers)
  // ==============================
  const ensureUserInFirestore = async (uid, phone, name) => {
    if (!uid) return;
    const userRef = firestore().collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      await userRef.set({
        uid,
        phone: phone || "",
        name: name || "",
        isOnline: true,
        lastSeen: firestore.FieldValue.serverTimestamp(),
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  };

  const audioRecorderPlayer = useRef(new AudioRecorderPlayer()).current;
  const flatListRef = useRef(null);

  // ==============================
  // ENSURE USER EXISTS IN FIRESTORE
  // ==============================
  useEffect(() => {
    if (!currentUser || !userId) return;

    const userRef = firestore().collection("users").doc(userId);

    userRef.get().then((doc) => {
      if (!doc.exists) {
        console.log("Creating user document in Firestore...");
        userRef.set({
          uid: userId,
          name: userName || "Unknown",
          photo: userPhoto || "",
          createdAt: firestore.FieldValue.serverTimestamp(),
          isOnline: true,
          lastSeen: firestore.FieldValue.serverTimestamp(),
        });
      } else {
        console.log("User document already exists:", doc.data());
      }
    });
  }, [currentUser, userId]);
   
   const openCloudMeeting = useCallback(async () => {
     const url = "https://meet.vemeet.online";

     try {
       await Linking.openURL(url);
     } catch (error) {
       console.log("Error opening meeting:", error);
       Alert.alert("Error", "Unable to open meeting link");
     }
   }, []);

// ==============================
// START AUDIO CALL
// ==============================
const startAudioCall = async () => {

  try {

    const callRef = firestore().collection("calls").doc();

    await callRef.set({
      callerId: currentUid,
      receiverId: userId,
      name: userName,
      roomId: `${currentUid}_${userId}`,
      type: "audio",
      status: "calling",
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    navigation.navigate("OutgoingCall", {
      callId: callRef.id,
      calleeId: userId,
      calleeName: userName,
      calleeNumber: userPhone || "",
      callerName: currentUser?.displayName || "NUKKAD User",
      callerNumber: currentUser?.phoneNumber || "",
      type: "audio",
    });

   } catch (error) {
    console.log("Call start error:", error);
  }

};

const startVideoCall = async () => {

  try {

    const callRef = firestore().collection("calls").doc();

    await callRef.set({
      callerId: currentUid,
      receiverId: userId,
      name: userName,
      roomId: `${currentUid}_${userId}`,
      type: "video",
      status: "calling",
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    navigation.navigate("OutgoingCall", {
      callId: callRef.id,
      calleeId: userId,
      calleeName: userName,
      calleeNumber: userPhone || "",
      callerName: currentUser?.displayName || "NUKKAD User",
      callerNumber: currentUser?.phoneNumber || "",
      type: "video",
    });

    } catch (error) {
      console.log("Video call start error:", error);
    }

  };

// ==============================
// LISTEN FOR INCOMING CALL
// ==============================
useEffect(() => {

  const unsubscribe = firestore()
    .collection("calls")
    .where("receiverId", "==", currentUid)
    .where("status", "==", "calling")
    .onSnapshot(snapshot => {

      snapshot.forEach(doc => {

        const data = doc.data();

        navigation.navigate("IncomingCall", {
          callId: doc.id,
          callerName: data.name,
        });

      });

    });

  return () => unsubscribe();

}, [currentUid]);

 useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <TouchableOpacity
        onPress={openCloudMeeting}
        style={{ marginRight: 15 }}
      >
        <Icon
          name="account-multiple-plus-outline"
          size={24}
          color="#00ff88"
        />
      </TouchableOpacity>
    ),
  });
}, [navigation, openCloudMeeting]);

/* ==============================
   LISTEN TO MESSAGES
==============================*/
useEffect(() => {
  const unsubscribe = firestore()
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .onSnapshot((snapshot) => {
      console.log("IDS:", snapshot.docs.map(d => d.id));  // 👈 ADD THIS
      const msgsMap = new Map();

      snapshot.forEach((doc) => {
  const data = doc.data();

  // ✅ ADD THIS BLOCK (AUTO DELIVER)
  if (
    data.receiverId === currentUid &&
    !data.deliveredTo?.includes(currentUid)
  ) {
    doc.ref.update({
      deliveredTo: firestore.FieldValue.arrayUnion(currentUid),
    });
  }

  // ensure no duplicate IDs
  if (!msgsMap.has(doc.id)) {
    msgsMap.set(doc.id, { id: doc.id, ...data });
  }
});


      const uniqueMsgs = Array.from(msgsMap.values());

      setMessages(uniqueMsgs);

      // scroll after render
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    });

  markMessagesAsRead();

  return () => unsubscribe();
}, [chatId]);

useEffect(() => {
  if (!currentUid) return;

  const unsub = firestore()
    .collection("users")
    .doc(currentUid)
    .onSnapshot(doc => {
      if (doc.exists) {
        setMyUserData(doc.data());
      }
    });

  return () => unsub();
}, [currentUid]);


/* ==============================
   MARK MESSAGES AS READ (OPTIONAL)
==============================*/
const markMessagesAsRead = async () => {
  const snapshot = await firestore()
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .where("receiverId", "==", currentUser.uid)
    .get();

  const batch = firestore().batch();

  snapshot.forEach((doc) => {
    const data = doc.data();

    // ✅ Only update if not already seen
    if (!data.seenBy?.includes(currentUser.uid)) {
      batch.update(doc.ref, {
        seenBy: firestore.FieldValue.arrayUnion(currentUser.uid),
        seenAt: firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  await batch.commit();
};


/* ==============================
   LISTEN TO OTHER USER
==============================*/
useEffect(() => {
  if (!userId) return;

  const unsubscribe = firestore()
    .collection("users")
    .doc(userId)
    .onSnapshot((doc) => {
      if (doc.exists) {
        setOtherUserData(doc.data());
      } else {
        ensureUserInFirestore(userId, null, userName);
      }
    });

  return () => unsubscribe();
}, [userId]);
  
   /* ==============================
     RESET UNREAD WHEN CHAT OPENS
  ============================== */
  useEffect(() => {
    if (!chatId || !currentUser?.uid) return;

    const chatRef = firestore().collection("chats").doc(chatId);

    chatRef.update({
      [`unreadCount.${currentUser.uid}`]: 0,
    }).catch(() => {});

  }, [chatId, currentUser?.uid]);

  useEffect(() => {
    const pinned = messages.find((m) => m.pinned);
    setPinnedMessage(pinned || null);
  }, [messages]);

  /* ==============================
   SEND TEXT MESSAGE (FINAL VERSION WITH UNREAD)
============================== */
const sendMessage = async () => {
  if (!text.trim()) return;

  try {
    // 1️⃣ Ensure chat document exists FIRST
    await firestore()
      .collection("chats")
      .doc(chatId)
      .set(
        {
          participants: [currentUser.uid, userId],
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    const messageData = {
  text: text.trim(),
  type: "text",

  senderId: currentUser.uid,
  senderName:
  myUserData?.name ||
  currentUser?.displayName ||
  currentUser?.phoneNumber ||
  "NUKKAD User",


  receiverId: userId,

  deliveredTo: [currentUser.uid],
  seenBy: [currentUser.uid],

  chatId: chatId,

  replyTo: replyMessage
    ? {
        id: replyMessage.id,
        text: replyMessage.text || "",
        senderId: replyMessage.senderId,
      }
    : null,

  createdAt: firestore.FieldValue.serverTimestamp(),
};



    // 2️⃣ Add message
    const messageRef = await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .add(messageData);

    console.log("MESSAGE ID:", messageRef.id);

    // 3️⃣ Update chat summary (for contact list)
    await firestore()
      .collection("chats")
      .doc(chatId)
      .set(
        {
          lastMessage: text.trim(),
          lastMessageType: "text",
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          [`unreadCount.${userId}`]: firestore.FieldValue.increment(1),
          [`unreadCount.${currentUser.uid}`]: 0,
        },
        { merge: true }
      );

    setText("");
    setReplyMessage(null);

  } catch (error) {
    console.log("MESSAGE ERROR:", error);
  }
};

/* ==============================
     SEND IMAGE
  ==============================*/
  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: "photo" });
    if (result.didCancel || !result.assets) return;

    const imageUri = result.assets[0].uri;

    const reference = storage().ref(
      `chatImages/${chatId}/${Date.now()}.jpg`
    );

    await reference.putFile(imageUri);
    const downloadURL = await reference.getDownloadURL();

    await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        imageUrl: downloadURL,
        type: "image",
        senderId: currentUser.uid,
    senderName:
  myUserData?.name ||
  currentUser?.displayName ||
  currentUser?.phoneNumber ||
  "NUKKAD User",

    receiverId: userId,
        status: "sent",
        seen: false,
        chatId,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
  };

/* ==============================
   SEND VIDEO
==============================*/
const pickVideo = async () => {
  const result = await launchImageLibrary({ mediaType: "video" });
  if (result.didCancel || !result.assets) return;

  const videoUri = result.assets[0].uri;

  const reference = storage().ref(
    `chatVideos/${chatId}/${Date.now()}.mp4`
  );

  await reference.putFile(videoUri);
  const downloadURL = await reference.getDownloadURL();

  await firestore()
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .add({
      videoUrl: downloadURL,   // 👈 IMPORTANT
      type: "video",
      senderId: currentUser.uid,
      senderName:
  myUserData?.name ||
  currentUser?.displayName ||
  currentUser?.phoneNumber ||
  "NUKKAD User",

      receiverId: userId,
      status: "sent",
      seen: false,
      chatId,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
};

/* ==============================
   ATTACHMENT MENU
==============================*/
const openAttachmentMenu = () => {
  Alert.alert(
    "Send Attachment",
    "Choose file type",
    [
      { text: "Image", onPress: pickImage },
      { text: "Video", onPress: pickVideo },
      { text: "Cancel", style: "cancel" }
    ]
  );
};

/* ==============================
     START RECORDING
  ==============================*/
  const startRecording = async () => {
    try {
      const path =
        Platform.OS === "android"
          ? `${RNFS.CachesDirectoryPath}/nukkad_${Date.now()}.mp4`
          : "nukkad_recording.m4a";

      setRecording(true);

      await audioRecorderPlayer.startRecorder(path);

      audioRecorderPlayer.addRecordBackListener((e) => {
        setRecordTime(
          audioRecorderPlayer.mmssss(
            Math.floor(e.currentPosition)
          )
        );
      });

    } catch (error) {
      console.log("Recording Error:", error);
    }
  };

  /* ==============================
     STOP RECORDING + SEND
  ==============================*/
  const stopRecording = async () => {
    const result = await audioRecorderPlayer.stopRecorder();
    audioRecorderPlayer.removeRecordBackListener();
    setRecording(false);

    console.log("Recorded file path:", result);

    // 🔥 CLEAN THE FILE PATH
    const cleanPath = result.replace("file://", "");

    const reference = storage().ref(
      `chatAudios/${chatId}/${Date.now()}.mp4`
    );

    await reference.putFile(cleanPath);

    const downloadURL = await reference.getDownloadURL();

    await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        audioUrl: downloadURL,
        type: "audio",
        duration: recordTime,
        senderId: currentUser.uid,
        senderName:
  myUserData?.name ||
  currentUser?.displayName ||
  currentUser?.phoneNumber ||
  "NUKKAD User",

        receiverId: userId,
        status: "sent",
        seen: false,
        chatId,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

    setRecordTime("00:00");
  };

  /* ==============================
     PLAY AUDIO
  ==============================*/
  const playAudio = async (url) => {
    await audioRecorderPlayer.startPlayer(url);
  };

  /* ==============================
   TRANSLATE MESSAGE (FINAL)
==============================*/
const translateMessage = async (message, targetLang) => {
  if (!message || !message.id || !message.text) return;

  try {
    // 🔹 INSERT YOUR GOOGLE TRANSLATE API KEY HERE
    const API_KEY = "AIzaSyAA2ek6Awufk39u-6d7YAnQadp0fBGF5iw";

    // 🔹 Call Google Translate API
    const response = await axios.post(
      `https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`,
      {
        q: message.text,
        target: targetLang,
        format: "text",
      }
    );

    // 🔹 Get translated text
    const translatedText =
      response.data?.data?.translations?.[0]?.translatedText || "";

    if (!translatedText) return;

    // 🔹 Save translated text to Firestore
    await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .doc(message.id)
      .update({
        translatedText,
        translatedTo: targetLang,
      });

    // 🔹 Update local messages state so UI refreshes immediately
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, translatedText } : m
      )
    );

    console.log("Message translated:", translatedText);
  } catch (error) {
    console.log("Translation error:", error);
    Alert.alert("Translation failed", "Check your API key and network.");
  }
};


  /* ==============================
     FORMAT TIME
  ==============================*/
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /* ==============================
   FORMAT LAST SEEN
==============================*/
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "";

  const date = timestamp.toDate();
  return (
    "Last seen " +
    date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
};
  
  /* ==============================
     STATUS TICKS
  ==============================*/
  const renderStatus = (item) => {
    if (item.senderId !== currentUser.uid) return null;

    if (item.status === "read") {
      return (
        <Ionicons name="checkmark-done" size={15} color="#34B7F1" />
      );
    }

    return (
      <Ionicons name="checkmark" size={15} color="#aaa" />
    );
  };

  /* ==============================
   MESSAGE ACTIONS / HANDLERS
==============================*/
const openMessageMenu = (message) => {
  setSelectedMessage(message);
  setActionModalVisible(true);
};

// ==============================
// DELETE FOR ME
// ==============================
const deleteForMe = async (message) => {
  console.log("Delete for me clicked:", message?.id);
  if (!message?.id) return;

  try {
    const ref = firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .doc(message.id);

    const doc = await ref.get();
    const data = doc.data();

    const deletedFor = data.deletedFor || [];

    if (!deletedFor.includes(currentUid)) {
      deletedFor.push(currentUid);
    }

    await ref.update({
      deletedFor: deletedFor,
    });

    // 🔥 Update local state so FlatList refreshes
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, deletedFor: deletedFor }
          : m
      )
    );

  } catch (error) {
    console.log("Delete for me error:", error);
  }
};

// ==============================
// DELETE FOR EVERYONE
// ==============================
const deleteForEveryone = async (message) => {
  if (!message?.id) return;

  try {

    // Check message age
    const messageTime = message.createdAt?.toDate?.() || new Date(message.createdAt);
    const now = new Date();

    const diffMinutes = (now - messageTime) / (1000 * 60);

    if (diffMinutes > 60) {
      Alert.alert(
        "Delete Failed",
        "You can only delete messages for everyone within 1 hour."
      );
      return;
    }

    await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .doc(message.id)
      .update({
        type: "deleted",
        deletedForEveryone: true,
        text: "This message was deleted",
      });

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? {
              ...m,
              type: "deleted",
              deletedForEveryone: true,
              text: "This message was deleted",
            }
          : m
      )
    );

  } catch (error) {
    console.log("Delete for everyone error:", error);
  }
};

// ==============================
// CONFIRM DELETE
// ==============================

const confirmDeleteForMe = (message) => {
  Alert.alert(
    "Delete Message",
    "Delete this message for you?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteForMe(message),
      },
    ]
  );
};

const confirmDeleteForEveryone = (message) => {
  Alert.alert(
    "Delete for Everyone",
    "This message will be deleted for all users.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteForEveryone(message),
      },
    ]
  );
};

// ==============================
// REPLY
// ==============================
const handleReply = (message) => {
  setReplyMessage(message);
};

// ==============================
// REPLY PRIVATELY
// ==============================
const handleReplyPrivately = (message) => {
  if (!message) return;

  const receiverId = message.senderId;

  navigation.navigate("ChatScreen", {
    userId: receiverId,
    userName: message.senderName || "User",
    userPhoto: message.senderPhoto || "",
    routeChatId: null, // will auto-generate 1:1 chatId
    isGroup: false,
    replyMessage: message, // optional pre-fill
  });
};

// ==============================
// TRANSLATE
// ==============================
const openTranslateMenu = (message) => {
  setSelectedMessage(message);
  setShowTranslateMenu(true);
};

// ==============================
// FORWARD
// ==============================
const handleForward = (message) => {
  navigation.navigate("ForwardScreen", {
    messageToForward: message,
    currentUser: currentUser,
  });
};

// ==============================
// PIN
// ==============================
const handlePinMessage = async (message) => {
  if (!message?.id) return;

  try {
    const messagesRef = firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages");

    // Get previously pinned messages
    const snapshot = await messagesRef
      .where("pinned", "==", true)
      .get();

    // Unpin all previous pinned messages
    const unpinPromises = snapshot.docs.map((doc) =>
      doc.ref.update({ pinned: false })
    );

    await Promise.all(unpinPromises);

    // Pin the selected message
    await messagesRef.doc(message.id).update({
      pinned: true,
    });

    console.log("Message pinned");

  } catch (error) {
    console.log("Pin message error:", error);
  }
};

// ==============================
// UNPIN MESSAGE
// ==============================
const handleUnpinMessage = async () => {
  if (!pinnedMessage?.id) return;

  try {
    await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .doc(pinnedMessage.id)
      .update({
        pinned: false,
      });

  } catch (error) {
    console.log("Unpin error:", error);
  }
};


 /* ==============================
     RENDER MESSAGE 
  ==============================*/
  const renderItem = ({ item, index }) => {
          
          // Hide message if deleted for current user
          if (item.deletedFor && item.deletedFor.includes(currentUid)) {
            return null;
          }

    const currentDate = item.createdAt?.toDate?.();

    const formattedTime = formatTime(item.createdAt);

    let showDate = false;

    if (index === 0) {
      showDate = true;
    } else {
      const previousDate =
        messages[index - 1]?.createdAt?.toDate?.();

      if (
        currentDate &&
        previousDate &&
        currentDate.toDateString() !==
          previousDate.toDateString()
      ) {
        showDate = true;
      }
    }

    // 🔥 Format Date Like WhatsApp
    let formattedDate = "";

    if (currentDate) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (currentDate.toDateString() === today.toDateString()) {
        formattedDate = "Today";
      } else if (
        currentDate.toDateString() === yesterday.toDateString()
      ) {
        formattedDate = "Yesterday";
      } else {
        formattedDate = currentDate.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      }
    }

    return (
  <View>
    {showDate && (
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>
          {formattedDate}
        </Text>
      </View>
    )}

    <View
      style={[
        styles.messageWrapper,
        item.senderId === currentUid
          ? { alignItems: "flex-end" }
          : { alignItems: "flex-start" },
      ]}
    >


      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => openMessageMenu(item)}
        style={[
          styles.messageBubble,
          item.senderId === currentUid
            ? styles.myMessage
            : styles.theirMessage,
        ]}
      >
      
      {/* SHOW SENDER NAME IN GROUP */}
{isGroup && item.senderId !== currentUid && (
  <Text style={{ color: "#00ff88", fontSize: 12, marginBottom: 3 }}>
    {item.senderName || "User"}
  </Text>
)}

      {item.forwarded && (
        <Text style={{ fontSize: 10, color: "#ddd", marginBottom: 4 }}>
          Forwarded
        </Text>
      )}

      {item.replyTo && (
        <View style={{
          backgroundColor: "rgba(0,0,0,0.3)",
          padding: 5,
          borderLeftWidth: 3,
          borderLeftColor: "#fff",
          marginBottom: 5,
          borderRadius: 5,
        }}>
          <Text style={{ fontSize: 11, color: "#ddd" }}>
            {item.replyTo.senderId === currentUid ? "You" : "User"}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: "#fff" }}>
            {item.replyTo.text}
          </Text>
        </View>
      )}

      {item.type === "text" && (
        <>
          <Text style={{ color: "#fff" }}>{item.text}</Text>

          {item.translatedText && (
            <Text style={{ color: "#00ff88", marginTop: 4 }}>
              🌐 {item.translatedText}
            </Text>
          )}
        </>
      )}

      {item.type === "deleted" && (
        <Text style={{ color: "#bbb", fontStyle: "italic" }}>
          {item.senderId === currentUid
            ? "You deleted this message"
            : "This message was deleted"}
        </Text>
      )}

      {item.type === "image" && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.imageMessage}
        />
      )}

      {item.type === "video" && (
        <Video
          source={{ uri: item.videoUrl }}
          style={styles.videoMessage}
          controls
          resizeMode="contain"
        />
      )}

      {item.type === "audio" && (
        <TouchableOpacity
          style={styles.audioBubble}
          onPress={() => playAudio(item.audioUrl)}
        >
          <Icon name="play" size={20} color="#fff" />
          <Text style={{ color: "#fff", marginLeft: 8 }}>
            {item.duration}
          </Text>
        </TouchableOpacity>
      )}

      {item.type !== "deleted" && (
        <View style={styles.footerRow}>
          <Text style={styles.timeText}>
            {formattedTime}
          </Text>

         {item.senderId === currentUid && (
  (() => {
    const isDelivered = item.deliveredTo?.includes(userId);
    const isSeen = item.seenBy?.includes(userId);

    return (
      <Text
        style={[
          styles.tickText,
          isSeen && { color: "#34B7F1" }
        ]}
      >
        {isSeen ? "✓✓" : isDelivered ? "✓✓" : "✓"}
      </Text>
    );
  })()
)}

        </View>
      )}

      </TouchableOpacity>
    </View>
  </View>
 );
};


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
     {/* HEADER */}
     <View style={styles.header}>

       {/* BACK BUTTON */}
       <TouchableOpacity onPress={() => navigation.goBack()}>
         <Icon name="chevron-left" size={24} color="#fff" />
       </TouchableOpacity>

       {/* CLICKABLE PROFILE AREA */}
       <TouchableOpacity
         style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
         onPress={() => {

           if (isGroup) {

             navigation.navigate("GroupInfoScreen", {
               groupId: groupId,
               groupName: userName,
               groupPhoto: userPhoto,
             });

           } else {

             navigation.navigate("UserProfileScreen", {
               user: {
                 uid: userId,
                 name: userName,
                 profilePic: userPhoto,
               },
             });

           }

         }}
       >

       {userPhoto ? (
         <Image
           source={{
             uri: userPhoto + "&t=" + Date.now(),
           }}
           style={styles.avatarImage}
         />
       ) : (
         <View style={styles.avatar}>
           <Text style={styles.avatarText}>
             {userName ? userName.charAt(0).toUpperCase() : "U"}
           </Text>
         </View>
       )}

         <View style={{ marginLeft: 10 }}>
           <Text style={styles.headerTitle}>
             {getContactName(userPhone) || userName || "NUKKAD User"}
           </Text>

           <Text style={{ fontSize: 12, color: "gray" }}>
             {otherUserData?.isOnline
               ? "Online"
               : formatLastSeen(otherUserData?.lastSeen)}
           </Text>
         </View>

       </TouchableOpacity>

       {/* AUDIO CALL BUTTON */}
       <TouchableOpacity
         onPress={startAudioCall}
         style={{ marginRight: 15 }}
       >
         <Icon name="phone-outline" size={24} color="#00ff88" />
       </TouchableOpacity>

       {/* VIDEO CALL BUTTON */}
       <TouchableOpacity
         onPress={startVideoCall}
         style={{ marginRight: 15 }}
       >
         <Icon name="video-outline" size={24} color="#00ff88" />
       </TouchableOpacity>

       {/* CLOUD MEETING BUTTON */}
       <TouchableOpacity onPress={openCloudMeeting}>
         <Icon name="account-multiple-plus-outline" size={24} color="#00ff88" />
       </TouchableOpacity>

      </View>

    {pinnedMessage && (
      <View
        style={{
          backgroundColor: "#202c33",
          padding: 10,
          borderBottomWidth: 1,
          borderColor: "#333",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#00a884", fontSize: 12 }}>
            📌 Pinned Message
          </Text>

          <Text numberOfLines={1} style={{ color: "#fff", marginTop: 2 }}>
            {pinnedMessage.text || "Media message"}
          </Text>
        </View>

        <TouchableOpacity onPress={handleUnpinMessage}>
          <Icon name="close" size={20} color="#aaa" />
        </TouchableOpacity>
      </View>
    )}

     {/* MESSAGES */}
     <ImageBackground
       source={require("../assets/chatbg.png")}
       style={{ flex: 1, }}
       resizeMode="repeat"
     >
       <FlatList
         ref={flatListRef}
         data={messages}
         renderItem={renderItem}
         keyExtractor={(item, index) => item.id + "_" + index}
         contentContainerStyle={{ padding: 10, paddingBottom: 10 }}
       />
     </ImageBackground>

      {/* INPUT AREA */}
      {replyMessage && (
        <View style={{
          backgroundColor: "#2a2a2a",
          padding: 8,
          borderLeftWidth: 4,
          borderLeftColor: "#00ff88",
          marginHorizontal: 10,
          marginBottom: 5,
          borderRadius: 6,
        }}>
          <Text style={{ color: "#00ff88", fontSize: 12 }}>
            Replying
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: "#fff", fontSize: 13 }}
          >
            {replyMessage.text || replyMessage.type}
          </Text>

          <TouchableOpacity
            onPress={() => setReplyMessage(null)}
            style={{ position: "absolute", right: 10, top: 5 }}
          >
            <Icon name="close" size={18} color="#aaa" />
          </TouchableOpacity>
        </View>
      )}
   
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={() => setEmojiVisible(true)}>
          <Icon name="emoticon-happy-outline" size={24} color="#00ff88" />
        </TouchableOpacity>

        <TouchableOpacity onPress={openAttachmentMenu} style={{ marginLeft: 10 }}>
          <Icon name="paperclip" size={24} color="#00ff88" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Type a message"
          placeholderTextColor="#888"
          value={text}
          onChangeText={setText}
        />

        {text.trim() ? (
          <TouchableOpacity onPress={sendMessage}>
            <Icon name="send" size={22} color="#00ff88" />
          </TouchableOpacity>
        ) : recording ? (
          <TouchableOpacity onPress={stopRecording}>
            <Icon name="stop" size={24} color="red" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={startRecording}>
            <Icon name="microphone" size={24} color="#00ff88" />
          </TouchableOpacity>
        )}
      </View>

      {/* EMOJI MODAL */}
      <Modal visible={emojiVisible} transparent animationType="slide">
        <View style={styles.emojiContainer}>
          {["😀","😂","😍","🔥","❤️","👍","🙏","🎉","😎","😭"].map((e, i) => (
            <TouchableOpacity key={i} onPress={() => {
              setText(text + e);
              setEmojiVisible(false);
            }}>
              <Text style={styles.emoji}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      {/* RECORD TIMER */}
      {recording && (
        <View style={styles.recordIndicator}>
          <Text style={{ color: "red" }}>
            ● Recording {recordTime}
          </Text>
        </View>
      )}

     {/* TRANSLATE LANGUAGE MODAL */}
     <Modal
       visible={showTranslateMenu}
       transparent={true}
       animationType="slide"
     >
       <View
         style={{
           flex: 1,
           backgroundColor: "rgba(0,0,0,0.5)",
           justifyContent: "flex-end",
         }}
       >
         <View
           style={{
             backgroundColor: "#1e1e1e",
             padding: 20,
             borderTopLeftRadius: 20,
             borderTopRightRadius: 20,
             maxHeight: "60%",
           }}
         >
           <Text style={{ color: "#fff", fontSize: 18, marginBottom: 15 }}>
             Translate Message
           </Text>

           <FlatList
             data={LANGUAGES}
             keyExtractor={(item) => item.code}
             renderItem={({ item }) => (
               <TouchableOpacity
                 style={{ paddingVertical: 12 }}
                 onPress={async () => {
                   if (!selectedMessage) return;

                   // Call your translateMessage function
                   await translateMessage(selectedMessage, item.code);

                   // Close the modal
                   setShowTranslateMenu(false);
                 }}
               >
                 <Text style={{ color: "#fff", fontSize: 16 }}>
                   🌐 {item.name}
                 </Text>
               </TouchableOpacity>
             )}
           />

           <TouchableOpacity
             onPress={() => setShowTranslateMenu(false)}
             style={{ marginTop: 15 }}
           >
             <Text style={{ color: "red", textAlign: "center" }}>
               Cancel
             </Text>
           </TouchableOpacity>
         </View>
       </View>
     </Modal>

     <Modal
       visible={actionModalVisible}
       transparent={true}
       animationType="slide"
       onRequestClose={() => setActionModalVisible(false)}
     >
       <View
         style={{
         flex: 1,
         backgroundColor: "rgba(0,0,0,0.5)",
         justifyContent: "flex-end",
       }}
       >
       <View
         style={{
         backgroundColor: "#1e1e1e",
         padding: 20,
         borderTopLeftRadius: 20,
         borderTopRightRadius: 20,
       }}
      >
      {selectedMessage && (
        <>
          {/* REPLY */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              handleReply(selectedMessage);
              setActionModalVisible(false);
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>Reply</Text>
          </TouchableOpacity>

          {/* REPLY PRIVATELY */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              handleReplyPrivately(selectedMessage);
              setActionModalVisible(false);
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>Reply Privately</Text>
          </TouchableOpacity>

          {/* TRANSLATE */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              openTranslateMenu(selectedMessage);
              setActionModalVisible(false);
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>🌐 Translate</Text>
          </TouchableOpacity>

          {/* FORWARD */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              handleForward(selectedMessage);
              setActionModalVisible(false);
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>Forward</Text>
          </TouchableOpacity>

          {/* PIN */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              handlePinMessage(selectedMessage);
              setActionModalVisible(false);
            }}
          >
            <Text style={{ color: "#fff", fontSize: 16 }}>Pin</Text>
          </TouchableOpacity>

          {/* DELETE FOR EVERYONE */}
          {selectedMessage.senderId === currentUid && (
            <TouchableOpacity
              style={{ paddingVertical: 12 }}
              onPress={() => {
                confirmDeleteForEveryone(selectedMessage);
                setActionModalVisible(false);
              }}
            >
              <Text style={{ color: "red", fontSize: 16 }}>Delete for Everyone</Text>
            </TouchableOpacity>
          )}

          {/* DELETE FOR ME */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => {
              confirmDeleteForMe(selectedMessage);
              setActionModalVisible(false);
            }}
          >
            <Text style={{ color: "red", fontSize: 16 }}>Delete for Me</Text>
          </TouchableOpacity>

          {/* CANCEL */}
          <TouchableOpacity
            style={{ paddingVertical: 12 }}
            onPress={() => setActionModalVisible(false)}
          >
            <Text style={{ color: "gray", fontSize: 16, textAlign: "center" }}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  </View>
</Modal>

     </KeyboardAvoidingView>
  );
}

/* ==============================
   STYLES
==============================*/

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },

  header: {
    height: 60,
    backgroundColor: "#111B21",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  headerTitle: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
    marginLeft: 10,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 15,
  },

  avatarText: {
    color: "#00ff88",
    fontWeight: "bold",
  },

  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: 15,
  },

  messageWrapper: { marginVertical: 5 },

  messageBubble: {
    padding: 10,
    borderRadius: 12,
    maxWidth: "80%",
  },

  myMessage: {
    backgroundColor: "#1daa61",
    borderTopRightRadius: 0,
  },

  theirMessage: {
    backgroundColor: "#1F1F1F",
    borderTopLeftRadius: 0,
  },

  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 10,
    marginBottom: 6,
  },

  videoMessage: {
    width: 250,
    height: 200,
    borderRadius: 10,
    marginBottom: 6,
  },

  audioContainer: {
    backgroundColor: "#ddd",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 6,
  },

  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },

  timeText: { fontSize: 10, color: "#fff" },

  inputContainer: {
    flexDirection: "row",
    padding: 8,
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },

  input: {
    flex: 1,
    backgroundColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 15,
    color: "#fff",
    height: 40,
    marginHorizontal: 10,
  },

  emojiContainer: {
    backgroundColor: "#1e1e1e",
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 20,
    justifyContent: "center",
  },

  emoji: {
    fontSize: 28,
    margin: 10,
  },
 
  tickText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    marginLeft: 3,
  },

  dateContainer: {
   alignSelf: "center",
   backgroundColor: "#2a2a2a",
   paddingHorizontal: 12,
   paddingVertical: 4,
   borderRadius: 10,
   marginVertical: 10,
 },

 dateText: {
   color: "#aaa",
   fontSize: 12,
   fontWeight: "500",
 },


  recordIndicator: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
  },
});
