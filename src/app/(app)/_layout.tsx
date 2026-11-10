import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { LockScreen, VerifiedWelcome, VerifyEmail } from '@/components/AccountGates';
import { Robot } from '@/components/Robot';
import { Btn, Chip, Field, Loading, Screen, Scroll, T } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { getQuickLogin } from '@/lib/quick-login';
import type { GradeLevel } from '@/lib/types';
import { C } from '@/theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * Gates before the app, in order:
 *   lock screen (PIN / fingerprint, only on a remembered session with quick login set up)
 *   → profile problems → "Check your email" → "Email verified!" (first time only) → the app.
 */
export default function AppLayout() {
  const { user, profile, profileStatus, emailVerified, unlocked } = useAuth();
  const [lock, setLock] = useState<'checking' | 'none' | 'set'>('checking');

  useEffect(() => {
    if (!user) return;
    getQuickLogin(user.uid)
      .then((q) => setLock(q?.pinHash ? 'set' : 'none'))
      .catch(() => setLock('none'));
  }, [user]);

  if (lock === 'checking') return <Loading />;
  if (lock === 'set' && !unlocked) return <LockScreen />;
  if (profileStatus === 'loading') return <Loading />;
  if (profileStatus === 'error') return <ProfileError />;
  if (profileStatus === 'missing') return <FinishProfile />;
  if (!emailVerified) return <VerifyEmail />;
  if (!(profile?.claimed ?? []).includes('verified')) return <VerifiedWelcome />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }} />;
}

/** Firestore refused to load the profile. Almost always: security rules not deployed yet. */
function ProfileError() {
  const { profileError, retryProfile, logOut } = useAuth();
  const denied = profileError === 'permission-denied';
  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
        <View style={{ alignItems: 'center' }}><Robot size={120} intro="no" /></View>
        <T w={900} size={22} style={{ textAlign: 'center' }}>{denied ? 'Database is locked' : 'Could not load your account'}</T>
        <T color={C.muted} style={{ textAlign: 'center' }}>
          {denied
            ? 'Firestore blocked the request. Deploy the security rules first:\nnpx firebase-tools deploy --only firestore:rules'
            : 'Check your internet connection, then try again.'}
        </T>
        {profileError && !denied ? <T size={12.5} color={C.faint} style={{ textAlign: 'center' }}>Error: {profileError}</T> : null}
        <Btn title="Try again" icon="clock" onPress={retryProfile} style={{ marginTop: 8 }} />
        <Btn title="Log out" variant="ghost" icon="logout" onPress={logOut} />
      </View>
    </Screen>
  );
}

const GRADES: GradeLevel[] = ['Elementary', 'High School', 'Senior High', 'College'];

/** The account exists in Authentication but has no profile document yet. */
function FinishProfile() {
  const { user, createProfile, logOut } = useAuth();
  const parts = (user?.displayName ?? '').split(' ').filter(Boolean);
  const [firstName, setFirstName] = useState(parts[0] ?? '');
  const [middleName, setMiddleName] = useState(parts.length > 2 ? parts.slice(1, -1).join(' ') : '');
  const [lastName, setLastName] = useState(parts.length > 1 ? parts[parts.length - 1] : '');
  const [grade, setGrade] = useState<GradeLevel>('High School');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) return setError('Type your first and last name.');
    setBusy(true);
    setError(null);
    try {
      await createProfile({ firstName, middleName, lastName, gradeLevel: grade });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'permission-denied' ? 'Firestore blocked this. Deploy the security rules first.' : 'Could not save. Check your internet and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Scroll>
          <View style={{ alignItems: 'center', marginTop: 12 }}><Robot size={96} intro="wave" /></View>
          <T w={900} size={24} style={{ textAlign: 'center', marginTop: 8 }}>Finish your profile</T>
          <T color={C.muted} style={{ textAlign: 'center', marginBottom: 20 }}>{user?.email}{'\n'}One more step before you start reviewing.</T>
          <View style={{ gap: 16 }}>
            <Field label="First name" icon="user" value={firstName} onChangeText={setFirstName} placeholder="Juan" />
            <Field label="Middle name" optional icon="user" value={middleName} onChangeText={setMiddleName} placeholder="Santos" />
            <Field label="Last name" icon="user" value={lastName} onChangeText={setLastName} placeholder="Dela Cruz" />
            <T w={800} size={14.5} color={C.ink2}>What grade level are you in?</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GRADES.map((g) => <Chip key={g} title={g} on={grade === g} onPress={() => setGrade(g)} style={{ width: '48.5%', borderRadius: 14 }} />)}
            </View>
            {error && <T w={700} color={C.danger}>{error}</T>}
            <Btn title="Save and continue" onPress={save} loading={busy} />
            <Btn title="Log out" variant="ghost" onPress={logOut} />
          </View>
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
