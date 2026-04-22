// src/services/NotificationService.ts

import { Alert, Platform } from "react-native";
import notifee, {
  AndroidImportance,
  EventType,
  AndroidColor,
  TimestampTrigger,
  TriggerType,
} from "@notifee/react-native";

import { navigationRef } from "../../App";

// Keep track of navigation reference
let navRef: any = null;

export const setNavigationRef = (ref: any) => {
  navRef = ref;
};

// Show simple toast notification
export const showToast = (message: string) => {
  console.log("TOAST:", message);
  if (Platform.OS === "android") {
    notifee.displayNotification({
      title: "NUKKAD",
      body: message,
      android: {
        channelId: "default",
        smallIcon: "ic_launcher",
        color: AndroidColor.GREEN,
      },
    });
  } else {
    Alert.alert("NUKKAD", message);
  }
};

// Show incoming call full-screen alert (lock screen)
export const showIncomingCall = async (call: {
  callId: string;
  callerName: string;
  callerNumber: string;
  type: "audio" | "video";
}) => {
  try {
    // Create Android channel
    const channelId = await notifee.createChannel({
      id: "calls",
      name: "Incoming Calls",
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: "default",
    });

    await notifee.displayNotification({
      title: call.callerName,
      body: `${call.type === "video" ? "Video" : "Audio"} Call`,
      android: {
        channelId,
        category: "call",
        fullScreenAction: {
          id: "accept",
        },
        actions: [
          {
            title: "Accept",
            pressAction: { id: "accept" },
          },
          {
            title: "Reject",
            pressAction: { id: "reject" },
          },
        ],
        color: AndroidColor.GREEN,
        smallIcon: "ic_launcher",
        autoCancel: false,
        ongoing: true,
      },
      ios: {
        sound: "default",
        categoryId: "incoming_call",
      },
      data: {
        callId: call.callId,
        callerName: call.callerName,
        callerNumber: call.callerNumber,
        type: call.type,
      },
    });
  } catch (err) {
    console.log("Incoming call notification error", err);
  }
};

// Handle notification events (click, dismiss, actions)
export const registerNotificationEvents = () => {
  notifee.onForegroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction.id;
      const data = detail.notification?.data;

      if (!data) return;

      if (actionId === "accept") {
        console.log("Call accepted:", data);
        navRef?.navigate("CallScreen", {
          callId: data.callId,
          callerName: data.callerName,
          callerNumber: data.callerNumber,
          isCaller: false,
          type: data.type,
        });
      } else if (actionId === "reject") {
        console.log("Call rejected:", data);
        // TODO: Update Firestore call status if needed
      }
    }
  });

  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS) {
      const actionId = detail.pressAction.id;
      const data = detail.notification?.data;

      if (!data) return;

      if (actionId === "accept") {
        console.log("Background call accepted:", data);
      } else if (actionId === "reject") {
        console.log("Background call rejected:", data);
      }
    }
  });
};

// Show message notification
export const showMessageNotification = async (title: string, body: string) => {
  try {
    const channelId = await notifee.createChannel({
      id: "messages",
      name: "Messages",
      importance: AndroidImportance.DEFAULT,
    });

    await notifee.displayNotification({
      title,
      body,
      android: { channelId, smallIcon: "ic_launcher" },
    });
  } catch (err) {
    console.log("Message notification error", err);
  }
};

// Schedule reminder notification (optional)
export const scheduleNotification = async (title: string, body: string, seconds: number) => {
  try {
    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + seconds * 1000,
    };

    const channelId = await notifee.createChannel({
      id: "default",
      name: "Default",
      importance: AndroidImportance.DEFAULT,
    });

    await notifee.createTriggerNotification(
      {
        title,
        body,
        android: { channelId, smallIcon: "ic_launcher" },
      },
      trigger
    );
  } catch (err) {
    console.log("Schedule notification error", err);
  }
};

// Cancel all notifications
export const cancelAllNotifications = async () => {
  try {
    await notifee.cancelAllNotifications();
  } catch (err) {
    console.log("Cancel notifications error", err);
  }
};

// Cancel specific notification
export const cancelNotification = async (notificationId: string) => {
  try {
    await notifee.cancelNotification(notificationId);
  } catch (err) {
    console.log("Cancel notification error", err);
  }
};

// Test function
export const testNotification = async () => {
  try {
    await showToast("This is a test notification");
    await scheduleNotification("Test Title", "Test Body", 5);
  } catch (err) {
    console.log("Test notification error", err);
  }
};

// iOS specific call category setup
export const setupIOSCategories = async () => {
  try {
    await notifee.setNotificationCategories([
      {
        id: "incoming_call",
        actions: [
          { id: "accept", title: "Accept", foreground: true },
          { id: "reject", title: "Reject", foreground: true },
        ],
      },
    ]);
  } catch (err) {
    console.log("iOS categories setup error", err);
  }
};

// Ensure default Android channel
export const setupDefaultAndroidChannel = async () => {
  try {
    await notifee.createChannel({
      id: "default",
      name: "Default",
      importance: AndroidImportance.DEFAULT,
    });
  } catch (err) {
    console.log("Android default channel error", err);
  }
};
