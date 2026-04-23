const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const admin = require("firebase-admin");

admin.initializeApp();

// ⚠️ IMPORTANT: set via env or secrets
const API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

exports.translatetext = onRequest({ cors: true }, async (req, res) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await admin.auth().verifyIdToken(token);

    const { text, target } = req.body;

    if (!text || !target) {
      return res.status(400).json({ error: "Missing text or target" });
    }

    if (!API_KEY) {
      return res.status(500).json({
        error: "Missing GOOGLE_TRANSLATE_API_KEY",
      });
    }

    const response = await axios.post(
      "https://translation.googleapis.com/language/translate/v2",
      {
        q: text,
        target,
        format: "text",
      },
      {
        params: {
          key: API_KEY,
        },
        timeout: 10000,
      }
    );

    const translated =
      response.data?.data?.translations?.[0]?.translatedText || text;

    return res.json({ translated });
  } catch (err) {
    console.error("TRANSLATION ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Translation failed",
      details: err.response?.data || err.message,
    });
  }
});
