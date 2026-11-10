import { browserLocalPersistence, getAuth, initializeAuth, type Auth } from '@firebase/auth';
import type { FirebaseApp } from 'firebase/app';

/** Web preview (npx expo start --web): browser storage. The phone uses auth-init.native.ts. */
export function createAuth(app: FirebaseApp, firstInit: boolean): Auth {
  return firstInit ? initializeAuth(app, { persistence: browserLocalPersistence }) : getAuth(app);
}
