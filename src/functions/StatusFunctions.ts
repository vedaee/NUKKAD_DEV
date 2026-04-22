// src/functions/StatusFunctions.ts
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";

export interface Status {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string;
  mediaUrl: string;
  createdAt: any;
  seenBy: string[];
}

// -----------------------------
// FETCH ALL STATUSES
// -----------------------------
export const fetchStatuses = async (): Promise<Status[]> => {
  const snapshot = await firestore().collection("statuses").get();
  const now = new Date().getTime();

  // Remove expired statuses (older than 24h)
  snapshot.docs.forEach(async (doc) => {
    const createdAt = doc.data().createdAt?.toDate?.().getTime();
    if (createdAt && now - createdAt > 24 * 60 * 60 * 1000) {
      await firestore().collection("statuses").doc(doc.id).delete();
    }
  });

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Status));
};

// -----------------------------
// FETCH SPECIFIC USER STATUSES
// -----------------------------
export const fetchUserStatuses = async (userId: string): Promise<Status[]> => {
  const snapshot = await firestore().collection("statuses").where("userId", "==", userId).orderBy("createdAt").get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Status));
};

// -----------------------------
// ADD STATUS
// -----------------------------
export const addStatus = async (userId: string, userName: string, userPhoto: string, uri: string) => {
  const filename = `${userId}_${Date.now()}.jpg`;
  const ref = storage().ref(`statuses/${filename}`);

  await ref.putFile(uri);
  const downloadURL = await ref.getDownloadURL();

  await firestore().collection("statuses").add({
    userId,
    userName,
    userPhoto,
    mediaUrl: downloadURL,
    createdAt: firestore.FieldValue.serverTimestamp(),
    seenBy: [],
  });
};

// -----------------------------
// MARK STATUS AS SEEN
// -----------------------------
export const markStatusSeen = async (statusId: string, userId: string) => {
  const statusRef = firestore().collection("statuses").doc(statusId);
  await statusRef.update({
    seenBy: firestore.FieldValue.arrayUnion(userId)
  });
};
