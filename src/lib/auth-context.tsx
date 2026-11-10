import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as updateAuthProfile,
  type User,
} from '@firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { auth, db } from './firebase';
import { DEFAULT_OUTFIT, type GradeLevel, type UserProfile } from './types';

type SignUpInput = {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  password: string;
  gradeLevel: GradeLevel;
};

type ProfileInput = Pick<SignUpInput, 'firstName' | 'middleName' | 'lastName' | 'gradeLevel'>;

/** loading: waiting for Firestore · ready: profile loaded · missing: account has no profile document
 *  (e.g. sign-up happened before the security rules were deployed) · error: Firestore refused or failed. */
export type ProfileStatus = 'loading' | 'ready' | 'missing' | 'error';

type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  profileStatus: ProfileStatus;
  profileError: string | null;
  initializing: boolean;
  /** Creates the profile document for an account that does not have one yet. */
  createProfile: (input: ProfileInput) => Promise<void>;
  /** Re-reads the profile after an error (e.g. once the rules are deployed). */
  retryProfile: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
  /** Email verification: Firebase emails a link (free, works on the Spark plan). */
  emailVerified: boolean;
  /** Emails a new verification link to the signed-in student. */
  sendVerification: () => Promise<void>;
  /** Re-reads the account from Firebase; returns true once the email is verified. */
  checkVerified: () => Promise<boolean>;
  /** Quick login lock: false on a cold start when PIN/fingerprint is set up, until unlocked. */
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
};

const AuthContext = createContext<AuthState | null>(null);

function newProfile(input: ProfileInput, email: string): UserProfile {
  return {
    firstName: input.firstName.trim(),
    middleName: input.middleName.trim() || null,
    lastName: input.lastName.trim(),
    email,
    gradeLevel: input.gradeLevel,
    outfit: DEFAULT_OUTFIT,
    remindersOn: true,
    reminderLeadMin: 15,
    dailyReminderOn: false,
    stats: { attempts: 0, totalPercent: 0, bestPercent: 0, perfectScores: 0, streak: 0, lastStudyDay: null, xp: 0 },
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('loading');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  // A fresh password login or sign-up counts as unlocked; a remembered session starts locked
  // (the app layout skips the lock when quick login is not set up).
  const [unlocked, setUnlocked] = useState(false);
  // During sign-up the account exists a moment before its profile is saved; don't show "missing" then.
  const signingUp = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    setEmailVerified(!!u?.emailVerified);
    if (!u) setUnlocked(false);
    setProfile(null);
    setProfileStatus('loading');
    setProfileError(null);
    setInitializing(false);
  }), []);

  // Live profile document: outfit, reminders and stats update everywhere at once.
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setProfileStatus(snap.exists() ? 'ready' : signingUp.current ? 'loading' : 'missing');
        setProfileError(null);
      },
      (e) => {
        // Usually "permission-denied": the Firestore security rules are not deployed yet.
        setProfileStatus('error');
        setProfileError((e as { code?: string }).code ?? e.message);
      },
    );
  }, [user, attempt]);

  const value: AuthState = {
    user,
    profile,
    profileStatus,
    profileError,
    initializing,
    retryProfile: () => {
      setProfileStatus('loading');
      setAttempt((n) => n + 1);
    },
    createProfile: async (input) => {
      if (!user) throw new Error('Not signed in');
      await setDoc(doc(db, 'users', user.uid), { ...newProfile(input, user.email ?? ''), createdAt: serverTimestamp() });
    },
    signIn: async (email, password) => {
      setUnlocked(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    emailVerified,
    sendVerification: async () => {
      if (auth.currentUser) await sendEmailVerification(auth.currentUser);
    },
    checkVerified: async () => {
      if (!auth.currentUser) return false;
      await reload(auth.currentUser);
      const v = !!auth.currentUser.emailVerified;
      if (v) {
        // Refresh the ID token so Firestore rules see email_verified too.
        await auth.currentUser.getIdToken(true);
        setEmailVerified(true);
      }
      return v;
    },
    unlocked,
    setUnlocked,
    signUp: async ({ firstName, middleName, lastName, email, password, gradeLevel }) => {
      signingUp.current = true;
      setUnlocked(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const fullName = [firstName, middleName, lastName].map((s) => s.trim()).filter(Boolean).join(' ');
        await updateAuthProfile(cred.user, { displayName: fullName });
        await setDoc(doc(db, 'users', cred.user.uid), { ...newProfile({ firstName, middleName, lastName, gradeLevel }, email.trim()), createdAt: serverTimestamp() });
        // Firebase emails a verification link; the app waits on the "Check your email" screen.
        await sendEmailVerification(cred.user).catch((e) => console.warn('Could not send the verification link; the student can tap Resend link.', e?.code));
      } catch (e) {
        // The account may exist without a profile now; the app will offer "Finish your profile".
        if (auth.currentUser) setProfileStatus((st) => (st === 'loading' ? 'missing' : st));
        throw e;
      } finally {
        signingUp.current = false;
      }
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(auth, email.trim());
    },
    logOut: async () => {
      await signOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** For screens inside the signed-in area, where user is guaranteed by the layout guard. */
export function useUid() {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user.uid;
}

/** Turns Firebase error codes into short messages a student can act on. */
export function authErrorMessage(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'That email address looks wrong.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account uses that email yet.',
    'auth/email-already-in-use': 'An account already uses that email. Try logging in.',
    'auth/weak-password': 'Use at least 8 characters for your password.',
    'auth/network-request-failed': 'No internet connection. Check it and try again.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}
