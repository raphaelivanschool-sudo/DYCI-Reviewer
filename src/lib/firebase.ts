import { connectAuthEmulator, type Auth } from '@firebase/auth';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

import { setupAppCheck } from './app-check';
import { createAuth } from './auth-init';

// Values come from .env (copy .env.example). They are public client identifiers, not secrets:
// security comes from firestore.rules and storage.rules.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Without a .env the app shows a "connect Firebase" screen; the placeholders only keep init from throwing.
const config = isFirebaseConfigured ? firebaseConfig : { apiKey: 'missing', projectId: 'metanoia-not-configured', appId: 'missing' };

const firstInit = getApps().length === 0;
export const app = firstInit ? initializeApp(config) : getApp();

// initializeAuth may run only once per app; after a fast refresh reuse the existing instance.
// auth-init.native.ts (phone) and auth-init.ts (web preview) pick the right persistence.
export const auth: Auth = createAuth(app, firstInit);

// App Check must start before Gemini (Firebase AI Logic) is used. See app-check.ts.
if (firstInit && isFirebaseConfigured) setupAppCheck(app);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, process.env.EXPO_PUBLIC_FUNCTIONS_REGION || 'asia-southeast1');

// Local testing without touching the real project: `npx firebase emulators:start`, then set
// EXPO_PUBLIC_USE_EMULATORS=true. Android emulator reaches your computer at 10.0.2.2; a real phone
// needs your computer's LAN IP in EXPO_PUBLIC_EMULATOR_HOST.
if (process.env.EXPO_PUBLIC_USE_EMULATORS === 'true' && firstInit) {
  const host = process.env.EXPO_PUBLIC_EMULATOR_HOST || '127.0.0.1';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
  connectFunctionsEmulator(functions, host, 5001);
}
