const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

exports.sendMessageNotification = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data.data();

    if (!message.receiverId) return;

    // Get receiver document
    const receiverDoc = await admin
      .firestore()
      .collection("users")
      .doc(message.receiverId)
      .get();

    if (!receiverDoc.exists) return;

    const receiverData = receiverDoc.data();
    const token = receiverData.fcmToken;

    if (!token) return;

    const payload = {
      notification: {
        title: "New Message",
        body:
          message.type === "image"
            ? "📷 Image"
            : message.text || "You received a message",
      },
      data: {
        chatId: message.chatId || "",
        senderId: message.senderId || "",
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
        },
      },
      token: token,
    };

    try {
      await admin.messaging().send(payload);
      console.log("✅ Push sent successfully");
    } catch (error) {
      console.error("❌ Push error:", error);
    }
  }
);
