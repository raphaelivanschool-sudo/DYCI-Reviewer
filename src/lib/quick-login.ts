import { Platform } from 'react-native';

import { optionalNative } from './optional-native';

/* eslint-disable @typescript-eslint/no-require-imports -- loaded lazily so a missing native module can't crash the app */
const Crypto = optionalNative('expo-crypto', () => require('expo-crypto') as typeof import('expo-crypto'));
const LocalAuthentication = optionalNative('expo-local-authentication', () => require('expo-local-authentication') as typeof import('expo-local-authentication'));
const SecureStore = optionalNative('expo-secure-store', () => require('expo-secure-store') as typeof import('expo-secure-store'));
/* eslint-enable @typescript-eslint/no-require-imports */

/**
 * Quick login (PIN + fingerprint) after the first email/password login.
 * Everything stays on this phone, in the encrypted SecureStore:
 *  - the PIN is never stored, only a salted SHA-256 hash of it;
 *  - the fingerprint check is done by the phone; the app only learns "yes, it's the owner".
 * Not available in the web preview.
 */
export type QuickLogin = { pinHash: string | null; salt: string; biometrics: boolean; wrong: number };

export const MAX_WRONG = 5;
const key = (uid: string) => `metanoia_ql_${uid.replace(/[^\w]/g, '')}`;

export async function quickLoginSupported() {
  // Needs all three native modules; without them students simply log in with email and password.
  if (Platform.OS === 'web' || !Crypto || !SecureStore || !LocalAuthentication) return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function biometricsAvailable() {
  if (Platform.OS === 'web' || !LocalAuthentication) return false;
  const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return hw && enrolled;
}

export async function getQuickLogin(uid: string): Promise<QuickLogin | null> {
  if (!SecureStore || !(await quickLoginSupported())) return null;
  const raw = await SecureStore.getItemAsync(key(uid));
  return raw ? (JSON.parse(raw) as QuickLogin) : null;
}

async function save(uid: string, q: QuickLogin) {
  if (!SecureStore) throw new Error('Quick login is not available on this phone.');
  await SecureStore.setItemAsync(key(uid), JSON.stringify(q));
}

const hash = (salt: string, pin: string) => {
  if (!Crypto) throw new Error('Quick login is not available on this phone.');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
};

export async function setupQuickLogin(uid: string, pin: string, biometrics: boolean) {
  if (!Crypto) throw new Error('Quick login is not available on this phone.');
  const salt = Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  await save(uid, { salt, pinHash: await hash(salt, pin), biometrics, wrong: 0 });
}

export async function disableQuickLogin(uid: string) {
  if (SecureStore && (await quickLoginSupported())) await SecureStore.deleteItemAsync(key(uid));
}

/** 'ok' | 'wrong' | 'locked' (too many wrong tries: quick login is turned off, password needed). */
export async function checkPin(uid: string, pin: string): Promise<'ok' | 'wrong' | 'locked'> {
  const q = await getQuickLogin(uid);
  if (!q?.pinHash) return 'locked';
  if ((await hash(q.salt, pin)) === q.pinHash) {
    await save(uid, { ...q, wrong: 0 });
    return 'ok';
  }
  const wrong = q.wrong + 1;
  if (wrong >= MAX_WRONG) {
    await disableQuickLogin(uid);
    return 'locked';
  }
  await save(uid, { ...q, wrong });
  return 'wrong';
}

export async function unlockWithBiometrics() {
  if (!LocalAuthentication) return false;
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock METAKNOWIA',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return res.success;
}
