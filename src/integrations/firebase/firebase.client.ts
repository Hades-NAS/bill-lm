import { getApps, initializeApp } from "firebase/app"
import { getFirestore } from "firebase/firestore"

// NOTE: This file is CLIENT-ONLY. All vars must be VITE_ prefixed (safe to expose in browser).
// For server-side Firebase access, use firebase.server.ts with Firebase Admin SDK instead.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
}

// Avoid re-initializing on HMR / SSR hydration
const clientApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0]

export const db = getFirestore(clientApp)
