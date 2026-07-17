import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase config — reads from Vite env vars (VITE_FIREBASE_*).
// Add these to your project .env (or Workspace Build Secrets) then rebuild.
const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

const app = firebaseConfigured
  ? (getApps()[0] ?? initializeApp(config))
  : null;

export const auth = app ? getAuth(app) : (null as never);
export const db = app ? getFirestore(app) : (null as never);
export const storage = app ? getStorage(app) : (null as never);
