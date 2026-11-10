import AsyncStorage from '@react-native-async-storage/async-storage';
// '@firebase/auth' (not 'firebase/auth') so Metro picks the React Native build,
// which is the one that exports getReactNativePersistence.
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from '@firebase/auth';
import type { FirebaseApp } from 'firebase/app';

/** Android / iOS: keep the user logged in between app launches. */
export function createAuth(app: FirebaseApp, firstInit: boolean): Auth {
  return firstInit ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) }) : getAuth(app);
}
