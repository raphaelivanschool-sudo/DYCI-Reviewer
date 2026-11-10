// @firebase/auth ships getReactNativePersistence only in its React Native build, and its package
// "exports" point TypeScript at the browser types. Metro picks the React Native build at runtime
// (the "react-native" export condition); this declaration tells TypeScript the function exists.
import type { Persistence } from '@firebase/auth';

declare module '@firebase/auth' {
  interface ReactNativeAsyncStorage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
