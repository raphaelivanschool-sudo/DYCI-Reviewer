import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function biometricsAvailable() {
  if (Platform.OS === 'web') return false;
  const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
  return hw && enrolled;
}

export async function getQuickLogin(uid: string): Promise<QuickLogin | null> {
  if (!(await quickLoginSupported())) return null;
  const raw = await SecureStore.getItemAsync(key(uid));
  return raw ? (JSON.parse(raw) as QuickLogin) : null;
}

async function save(uid: string, q: QuickLogin) {
  await SecureStore.setItemAsync(key(uid), JSON.stringify(q));
}

const hash = (salt: string, pin: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export async function setupQuickLogin(uid: string, pin: string, biometrics: boolean) {
  const salt = Array.from(Crypto.getRandomBytes(16), (b) => b.toString(16).padStart(2, '0')).join('');
  await save(uid, { salt, pinHash: await hash(salt, pin), biometrics, wrong: 0 });
}

export async function disableQuickLogin(uid: string) {
  if (await quickLoginSupported()) await SecureStore.deleteItemAsync(key(uid));
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
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock METAKNOWIA',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return res.success;
}
