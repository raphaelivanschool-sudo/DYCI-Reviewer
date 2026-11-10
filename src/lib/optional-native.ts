/**
 * Loads a library that needs native code, or returns null when the running app does not include it
 * (for example an Expo Go app that does not match the project's SDK, or an old dev build).
 * Callers turn the feature off instead of crashing the whole app at import time.
 *
 * Usage: const Crypto = optionalNative('expo-crypto', () => require('expo-crypto') as typeof import('expo-crypto'));
 * The require must stay a literal string inside the callback so Metro can bundle it.
 */
export function optionalNative<T>(name: string, load: () => T): T | null {
  try {
    return load();
  } catch (e) {
    if (__DEV__) {
      console.warn(
        `[${name}] native module not found, so this feature is off. ` +
          'Update Expo Go to the version for this SDK, or use a development build (npx expo run:android). ' +
          String((e as Error)?.message ?? e),
      );
    }
    return null;
  }
}
