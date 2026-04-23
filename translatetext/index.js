const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

exports.translatetext = onRequest(
  { cors: true },
  async (req, res) => {
    try {
      // 🔒 AUTH CHECK
      const token = req.headers.authorization?.split("Bearer ")[1];

      if (!token) {
        return res.status(401).send("Unauthorized");
      }

      await admin.auth().verifyIdToken(token);

      const { text, target } = req.body;

      console.log("INPUT:", text, target);

      // ✅ REAL TRANSLATION API CALL (SAFE VERSION)
      const response = await axios.post(
        "https://translation.googleapis.com/language/translate/v2",
        {
          q: text,
          target: target,
          format: "text",
        },
        {
          params: {
            key: process.env.GOOGLE_TRANSLATE_API_KEY,
          },
        }
      );

      const translated =
        response.data?.data?.translations?.[0]?.translatedText || text;

      console.log("OUTPUT:", translated);

      res.json({
        translated,
      });

    } catch (error) {
      console.error("ERROR:", error.response?.data || error.message);
      res.status(500).send(error.message);
    }
  }
);
