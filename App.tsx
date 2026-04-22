// App.tsx
console.log("🔥 APP STARTED");

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  AppState,
} from "react-native";

import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import messaging from "@react-native-firebase/messaging";

import { NavigationContainer } from "@react-navigation/native";
import { createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// Screens
import LoginScreen from "./src/screens/LoginScreen";
import ContactListScreen from "./src/screens/ContactListScreen";
import ChatScreen from "./src/screens/ChatScreen";
import UserProfileScreen from "./src/screens/UserProfileScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";
import GroupInfoScreen from "./src/screens/GroupInfoScreen";
import NewChatScreen from "./src/screens/NewChatScreen";
import StatusScreen from "./src/screens/StatusScreen";
import PrivateReplyScreen from "./src/screens/PrivateReplyScreen";
import ForwardScreen from "./src/screens/ForwardScreen";
import OutgoingCallScreen from "./src/screens/OutgoingCallScreen";
import IncomingCallScreen from "./src/screens/IncomingCallScreen";
import CallScreen from "./src/screens/CallScreen";

// Notifications
import {
  showToast,
  showIncomingCall,
  showMessageNotification,
  registerNotificationEvents,
  setNavigationRef,
} from "./src/services/NotificationService";

export const navigationRef = createNavigationContainerRef();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// -------------------------------
// MAIN TABS
// -------------------------------
const MainTabs = ({ route }: any) => {
  const { currentUser } = route.params;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: "#00ff88",
        tabBarStyle: { backgroundColor: "#000" },
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Chats")
            return <Icon name="chat" size={size} color={color} />;
          if (route.name === "Status")
            return <Icon name="circle-slice-8" size={size} color={color} />;
          if (route.name === "Calls")
            return <Icon name="phone" size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Chats"
        component={ContactListScreen}
        initialParams={{ currentUser }}
      />
      <Tab.Screen name="Status" component={StatusScreen} />
      <Tab.Screen
        name="Calls"
        component={() => (
          <View style={styles.centerBlack}>
            <Icon name="phone" size={60} color="#00ff88" />
            <Text style={{ color: "#fff" }}>Calls Coming Soon</Text>
          </View>
        )}
      />
    </Tab.Navigator>
  );
};

const MainTabsWrapper = ({ route }: any) => <MainTabs route={route} />;

const ChatScreenWrapper = ({ route, navigation }: any) => (
  <ChatScreen route={route} navigation={navigation} />
);

// -------------------------------
// APP COMPONENT
// -------------------------------
export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<any>(undefined);

  const handledCalls = useRef(new Set<string>());

  // -------------------------------
  // INIT NOTIFICATIONS
  // -------------------------------
  useEffect(() => {
    setNavigationRef(navigationRef);
    registerNotificationEvents();
  }, []);

  // -------------------------------
  // SAVE FCM TOKEN (SAFE)
  // -------------------------------
  const saveFcmToken = async (uid: string) => {
    try {
      await messaging().requestPermission();

      const token = await messaging().getToken();

      if (token) {
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
      } else {
        console.log("⚠️ FCM TOKEN NULL (TEST MODE)");
      }
    } catch (err) {
      console.log("❌ FCM ERROR:", err);
    }
  };

  // -------------------------------
  // 🔥 AUTH LISTENER + AUTO MIGRATION
  // -------------------------------
  useEffect(() => {
    console.log("🔥 AUTH LISTENER STARTED");

    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setInitializing(false);
        return;
      }

      try {
        const uid = firebaseUser.uid;
        const phoneRaw = firebaseUser.phoneNumber || "";

        // normalize last 10 digits
        const phone = phoneRaw.replace(/\D/g, "").slice(-10);

        const ref = firestore().collection("users").doc(uid);
        const doc = await ref.get();

        const oldData = doc.exists ? doc.data() : {};

        // ✅ AUTO FIX DOCUMENT
        await ref.set(
          {
            uid: uid,
            phone: phone,
            phoneRaw: phoneRaw,

            name: oldData?.name || "NUKKAD User",
            profilePic:
              oldData?.profilePic || "https://i.pravatar.cc/300",

            isOnline: true,
            lastSeen: firestore.FieldValue.serverTimestamp(),

            createdAt:
              oldData?.createdAt ||
              firestore.FieldValue.serverTimestamp(),

            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.log("🔥 USER DOCUMENT FIXED");

        // ✅ SAVE FCM
        await saveFcmToken(uid);

        setUser(firebaseUser);
      } catch (err) {
        console.log("❌ FIRESTORE ERROR:", err);
      }

      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  // -------------------------------
  // ONLINE / LAST SEEN TRACKING
  // -------------------------------
  useEffect(() => {
    if (!user?.uid) return;

    const ref = firestore().collection("users").doc(user.uid);

    const updateStatus = async (online: boolean) => {
      try {
        await ref.set(
          {
            isOnline: online,
            lastSeen: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (e) {
        console.log("STATUS ERROR:", e);
      }
    };

    updateStatus(true);

    const sub = AppState.addEventListener("change", (state) => {
      updateStatus(state === "active");
    });

    return () => {
      sub.remove();
      updateStatus(false);
    };
  }, [user]);

  // -------------------------------
  // INCOMING CALL LISTENER
  // -------------------------------
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = firestore()
      .collection("calls")
      .where("receiverId", "==", user.uid)
      .where("status", "==", "calling")
      .onSnapshot((snapshot) => {
        snapshot.forEach((doc) => {
          const data = doc.data();

          if (!data || handledCalls.current.has(doc.id)) return;

          handledCalls.current.add(doc.id);

          showToast(`${data.callerName || "NUKKAD User"} is calling`);

          showIncomingCall({
            callId: doc.id,
            callerName: data.callerName || "NUKKAD User",
            callerNumber: data.callerNumber || "",
            type: data.type || "audio",
          });

          if (navigationRef.isReady()) {
            navigationRef.navigate("IncomingCall", {
              callId: doc.id,
              callerName: data.callerName,
              callerNumber: data.callerNumber,
              isVideo: data.type === "video",
            });
          }
        });
      });

    return () => unsubscribe();
  }, [user]);

  // -------------------------------
  // FOREGROUND MESSAGE
  // -------------------------------
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (msg) => {
      if (msg.notification) {
        showMessageNotification(
          msg.notification.title || "NUKKAD",
          msg.notification.body || ""
        );
      }
    });

    return unsubscribe;
  }, []);

  // -------------------------------
  // LOADER
  // -------------------------------
  if (initializing || user === undefined) {
    return (
      <View style={styles.centerBlack}>
        <ActivityIndicator size="large" color="#00ff88" />
        <Text style={{ color: "#fff", marginTop: 10 }}>
          Loading NUKKAD...
        </Text>
      </View>
    );
  }

  // -------------------------------
  // NAVIGATION
  // -------------------------------
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabsWrapper}
              initialParams={{ currentUser: user }}
            />
            <Stack.Screen name="Chat" component={ChatScreenWrapper} />
            <Stack.Screen name="UserProfileScreen" component={UserProfileScreen} />
            <Stack.Screen name="MyProfile" component={MyProfileScreen} />
            <Stack.Screen name="GroupInfoScreen" component={GroupInfoScreen} />
            <Stack.Screen name="NewChat" component={NewChatScreen} />
            <Stack.Screen name="OutgoingCall" component={OutgoingCallScreen} />
            <Stack.Screen name="IncomingCall" component={IncomingCallScreen} />
            <Stack.Screen name="CallScreen" component={CallScreen} />
            <Stack.Screen name="PrivateReplyScreen" component={PrivateReplyScreen} />
            <Stack.Screen name="ForwardScreen" component={ForwardScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// -------------------------------
const styles = StyleSheet.create({
  centerBlack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
});
