const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

console.log("🔥 DEPLOY VERSION FINAL V2");

// 🔔 MESSAGE NOTIFICATION
exports.sendMessageNotification = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data.data();

    if (!message.receiverId) return;

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

// 🌐 TRANSLATE FUNCTION (V2 + SECRETS CORRECT)
exports.translatetext = onRequest(
  {
    cors: true,
    secrets: ["GOOGLE_TRANSLATE_KEY"], // ✅ IMPORTANT
  },
  async (req, res) => {
    try {
      const { text, target } = req.body;

      if (!text || !target) {
        return res.status(400).json({ error: "Missing text or target" });
      }

      // ✅ READ SECRET
      const API_KEY = process.env.GOOGLE_TRANSLATE_KEY;

      if (!API_KEY) {
        return res.status(500).json({ error: "API key missing" });
      }

      // 🔥 GOOGLE TRANSLATE API CALL
      const response = await axios.post(
        "https://translation.googleapis.com/language/translate/v2",
        {
          q: text,
          target,
          format: "text",
        },
        {
          params: { key: API_KEY },
        }
      );

      const translated =
        response.data?.data?.translations?.[0]?.translatedText || text;

      console.log("✅ TRANSLATED:", translated);

      return res.status(200).json({ translated });

    } catch (err) {
      console.error(
        "🔥 FULL TRANSLATE ERROR:",
        JSON.stringify(err.response?.data || err.message)
      );

      return res.status(500).json({
        error: err.response?.data || err.message,
      });
    }
  }
);
