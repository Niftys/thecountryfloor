"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "thecountryfloor.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "thecountryfloor",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "thecountryfloor.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "0",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:0:web:demo",
};

function getClientApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

let emulatorsConnected = false;

export function getClientAuth() {
  const auth = getAuth(getClientApp());
  if (
    !emulatorsConnected &&
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(getFirestore(getClientApp()), "127.0.0.1", 8080);
    emulatorsConnected = true;
  }
  return auth;
}

export function getClientDb() {
  getClientAuth(); // ensure emulator wiring once
  return getFirestore(getClientApp());
}
