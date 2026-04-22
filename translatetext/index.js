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

      // ❗ IMPORTANT: DO NOT CALL YOUR OWN URL HERE
      // 👉 Replace with your REAL translation API URL
      const response = await axios.post(
        "https://translatetext-6w6oihyfea-uc.a.run.app",
        {
          text,
          target,
        },
        {
          headers: {
            Authorization: `Bearer AIzaSyDm_1zod2BcKUYTLz1aZGIkPnHqT-IHsgI`,
          },
        }
      );

      console.log("OUTPUT:", response.data);

      res.json({
        translated: response.data.translated || "no result",
      });

    } catch (error) {
      console.error("ERROR:", error.response?.data || error.message);
      res.status(500).send(error.response?.data || error.message);
    }
  }
);
