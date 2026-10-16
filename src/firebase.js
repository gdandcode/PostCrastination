import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseReady = Object.values(firebaseConfig).every(Boolean);

const app = firebaseReady ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
// Firebase handles identity; profile storage is optional during the PostgreSQL migration.
export const db = app && import.meta.env.VITE_FIREBASE_PROFILE_STORAGE !== "false" ? getFirestore(app) : null;
export const googleProvider = new GoogleAuthProvider();
export { app as firebaseApp };
