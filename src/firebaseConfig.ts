// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "FALLBACK_KEY",
  authDomain: "nukkad-edc40.firebaseapp.com",
  projectId: "nukkad-edc40",
  storageBucket: "nukkad-edc40.firebasestorage.app",
  messagingSenderId: "650888533807",
  appId: "1:650888533807:web:bf112ec75804139fdbb3da",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export it so you can use it anywhere
export default app;
