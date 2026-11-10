import type { FirebaseApp } from 'firebase/app';
import { CustomProvider, initializeAppCheck } from 'firebase/app-check';

/**
 * Firebase App Check for Gemini (Firebase AI Logic enforces it).
 *
 * DEVELOPMENT: put a debug token in .env as EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN.
 *   Get it from Firebase console › Security › App Check › Apps › (your Web App) ⋮ › Manage debug tokens.
 *   With a debug token the SDK skips the real attestation provider and exchanges the token directly,
 *   so it works in Expo Go and in the web preview.
 *
 * RELEASE: a debug token inside the app can be copied by anyone, so before giving the app to other
 *   people replace this with a real provider (Play Integrity / App Attest in a development build)
 *   and delete the debug token from the console.
 */
export function setupAppCheck(app: FirebaseApp) {
  const debugToken = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
  if (!debugToken) return null;
  (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  return initializeAppCheck(app, {
    // Never called in debug mode; only here because initializeAppCheck requires a provider.
    provider: new CustomProvider({
      getToken: () => Promise.reject(new Error('No App Check provider yet. Set EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN for development.')),
    }),
    isTokenAutoRefreshEnabled: true,
  });
}
