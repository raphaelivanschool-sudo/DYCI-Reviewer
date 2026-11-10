import { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, View } from 'react-native';

import { useAuth } from '@/lib/auth-context';
import { claimReward } from '@/lib/db';
import { liveStreak, levelInfo, XP } from '@/lib/game';
import { biometricsAvailable, checkPin, getQuickLogin, MAX_WRONG, quickLoginSupported, setupQuickLogin, unlockWithBiometrics } from '@/lib/quick-login';
import { C } from '@/theme';

import { Icon } from './Icon';
import { Keypad, PIN_LENGTH, PinDots } from './Keypad';
import { Robot } from './Robot';
import { Btn, Card, Footer, Header, HeaderChip, HeaderDecor, LinkText, Screen, Scroll, StepBar, T, Toggle } from './ui';

const RESEND_SECONDS = 60;

/** Step 2 of sign-up: Firebase emailed a link; wait until it is tapped. */
export function VerifyEmail() {
  const { user, sendVerification, checkVerified, logOut } = useAuth();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Keep the latest checkVerified in a ref so the timers below are created only once.
  const checkRef = useRef(checkVerified);
  useEffect(() => {
    checkRef.current = checkVerified;
  });

  // Count down the resend timer, and quietly check every 5 s whether the link was tapped.
  useEffect(() => {
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    const poll = setInterval(() => checkRef.current().catch(() => {}), 5000);
    return () => {
      clearInterval(t);
      clearInterval(poll);
    };
  }, []);

  const resend = async () => {
    try {
      await sendVerification();
      setCooldown(RESEND_SECONDS);
      setMsg('We sent a new link. Check your inbox.');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMsg(code === 'auth/too-many-requests' ? 'Too many tries. Wait a few minutes before sending again.' : 'Could not send the email. Try again.');
    }
  };

  const check = async () => {
    setChecking(true);
    setMsg(null);
    try {
      if (!(await checkVerified())) setMsg('Not verified yet. Tap the link in the email first, then try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen>
      <Header title="Check your email" sub="Step 2 of 3 · Verify it's you" onBack={logOut}>
        <StepBar step={2} />
      </Header>
      <Scroll>
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <View style={{ width: 170, height: 140 }}>
            <View style={{ position: 'absolute', left: 20, top: 40, width: 130, height: 92, borderRadius: 18, backgroundColor: '#FBBF24', borderBottomWidth: 6, borderBottomColor: '#B45309', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mail" size={56} color="#422006" strokeWidth={2.4} />
            </View>
            <View style={{ position: 'absolute', right: -10, top: -6 }}><Robot size={78} intro="wave" mood="excited" /></View>
          </View>
          <T w={900} size={22} style={{ textAlign: 'center', marginTop: 10 }}>Tap the link we sent you</T>
          <T w={700} color={C.muted} style={{ textAlign: 'center', marginTop: 4 }}>
            We sent a verification link to{'\n'}<T w={900} color={C.ink}>{user?.email}</T>
          </T>
        </View>

        <Card style={{ marginTop: 18, gap: 10 }}>
          {['Open your email app', 'Find the email from METAKNOWIA', 'Tap “Verify email”, then come back here'].map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
                <T w={900} size={14} color="#fff">{i + 1}</T>
              </View>
              <T w={700} style={{ flex: 1 }}>{t}</T>
            </View>
          ))}
        </Card>

        <View style={{ marginTop: 14, padding: 12, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: C.primary50, flexDirection: 'row', gap: 10 }}>
          <Icon name="mail" color={C.primary700} />
          <View style={{ flex: 1, gap: 4 }}>
            <T w={700} size={13.5} color={C.ink2}>Didn’t get it? Check <T w={900} size={13.5}>Spam</T> or <T w={900} size={13.5}>Promotions</T>.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {cooldown > 0 ? <T w={800} size={13.5} color={C.muted}>Resend link in {cooldown}s</T> : <LinkText title="Resend link" onPress={resend} />}
              <T w={700} size={13.5} color={C.muted}>·</T>
              <LinkText title="Use another email" onPress={logOut} />
            </View>
          </View>
        </View>
        {msg && <T w={700} color={msg.startsWith('We sent') ? C.success700 : C.danger} style={{ marginTop: 12, textAlign: 'center' }}>{msg}</T>}
      </Scroll>
      <Footer>
        <Btn title="I've verified my email" onPress={check} loading={checking} />
        {Platform.OS !== 'web' && (
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <LinkText title="Open my email app" onPress={() => Linking.openURL(Platform.OS === 'ios' ? 'message://' : 'mailto:')} />
          </View>
        )}
      </Footer>
    </Screen>
  );
}

/** Step 3: celebrate, give the first XP, and offer quick login. Calls onDone when finished. */
export function VerifiedWelcome() {
  const { user, profile } = useAuth();
  const [stage, setStage] = useState<'welcome' | 'setup'>('welcome');
  const [supported, setSupported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    quickLoginSupported().then(setSupported);
  }, []);

  // Claiming the reward moves the layout on to the app (the "verified" key is now claimed).
  const finish = async () => {
    if (!user) return;
    setBusy(true);
    try {
      await claimReward(user.uid, 'verified', XP.verified, 'first-step');
    } finally {
      setBusy(false);
    }
  };

  // Back from the PIN screen returns here, so the student can still choose "Maybe later" on purpose.
  if (stage === 'setup') return <QuickLoginSetup onDone={finish} onSkip={() => setStage('welcome')} />;

  return (
    <Screen>
      <View style={{ backgroundColor: C.navy, paddingTop: 50, paddingBottom: 26, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', alignItems: 'center' }}>
        <HeaderDecor />
        <Confetti />
        <Robot size={110} intro="cheer" mood="excited" />
        <T w={900} size={26} color="#fff" style={{ marginTop: 4 }}>Email verified!</T>
        <T w={700} color="#BFDBFE">Welcome to METAKNOWIA, {profile?.firstName}!</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <HeaderChip gold><Icon name="star" size={15} color="#422006" /><T w={900} size={14} color="#422006">+{XP.verified} XP</T></HeaderChip>
          <HeaderChip><T w={900} size={14} color="#fff">Badge: First Step</T></HeaderChip>
        </View>
        <View style={{ alignSelf: 'stretch' }}><StepBar step={3} /></View>
      </View>
      <Scroll style={{ paddingTop: 20 }}>
        {supported ? (
          <>
            <T w={900} size={19}>Set up quick login</T>
            <T w={700} color={C.muted} style={{ marginBottom: 14 }}>Next time, unlock METAKNOWIA with your fingerprint or a 4-digit PIN.</T>
            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.success50 }}>
              <Icon name="shield" color={C.success} />
              <T w={700} size={13.5} color="#14532D" style={{ flex: 1 }}>Your fingerprint never leaves your phone. METAKNOWIA only asks your phone “is this the owner?”.</T>
            </Card>
          </>
        ) : (
          <T w={700} color={C.muted} style={{ textAlign: 'center' }}>You’re all set. Let’s start your first stage!</T>
        )}
      </Scroll>
      <Footer>
        {supported ? (
          <>
            <Btn title="Set up quick login" variant="success" icon="finger" onPress={() => setStage('setup')} />
            <View style={{ alignItems: 'center', marginTop: 12 }}><LinkText title="Maybe later" onPress={finish} /></View>
          </>
        ) : (
          <Btn title="Start my adventure" variant="gold" onPress={finish} loading={busy} />
        )}
      </Footer>
    </Screen>
  );
}

/**
 * Choose fingerprint on/off and create a PIN (typed twice). Used after sign-up and from Profile.
 * Fingerprint always needs a PIN as its backup, so nothing is saved until the PIN is confirmed.
 * Back on "Type it again" returns to the first PIN; back on the first PIN calls onSkip.
 */
export function QuickLoginSetup({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const { user } = useAuth();
  const [bioOk, setBioOk] = useState(false);
  const [useBio, setUseBio] = useState(true);
  const [first, setFirst] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    biometricsAvailable().then((ok) => {
      setBioOk(ok);
      setUseBio(ok);
    });
  }, []);

  const goBack = () => {
    if (first !== null) {
      setFirst(null);
      setPin('');
      setError(null);
    } else onSkip?.();
  };

  // Android's back button/gesture does the same as the header's back arrow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (first === null && !onSkip) return false;
      goBack();
      return true;
    });
    return () => sub.remove();
  });

  const onChange = async (v: string) => {
    setPin(v);
    setError(null);
    if (v.length < PIN_LENGTH) return;
    if (first === null) {
      setFirst(v);
      setPin('');
    } else if (v === first) {
      if (user) await setupQuickLogin(user.uid, v, useBio && bioOk);
      onDone();
    } else {
      setError('PINs did not match. Start again.');
      setFirst(null);
      setPin('');
    }
  };

  return (
    <Screen>
      <Header
        title={first === null ? 'Create your PIN' : 'Type it again'}
        sub={useBio && bioOk ? 'Needed as a backup for your fingerprint' : '4 digits you will remember'}
        back={first !== null || !!onSkip}
        onBack={goBack}
        right={<Robot size={56} still />}>
        <View style={{ marginTop: 20 }}><PinDots value={pin} error={!!error} /></View>
      </Header>
      <View style={{ flex: 1, paddingTop: 10 }}>
        {error && <T w={800} color={C.danger} style={{ textAlign: 'center', marginBottom: 10 }}>{error}</T>}
        {bioOk && (
          <View style={{ marginHorizontal: 20, marginBottom: 14 }}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon name="finger" size={28} color={C.primary} />
              <View style={{ flex: 1 }}>
                <T w={800}>Also use fingerprint</T>
                <T w={600} size={13} color={C.muted}>PIN stays as a backup</T>
              </View>
              <Toggle label="Use fingerprint" value={useBio} onChange={setUseBio} />
            </Card>
          </View>
        )}
        <Keypad value={pin} onChange={onChange} />
      </View>
    </Screen>
  );
}

/** Shown on a cold start when quick login is set up. */
export function LockScreen() {
  const { user, profile, setUnlocked, logOut } = useAuth();
  const [mode, setMode] = useState<'bio' | 'pin'>('pin');
  const [bio, setBio] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(false);

  const tryBio = async () => {
    if (await unlockWithBiometrics()) setUnlocked(true);
    else setMode('pin');
  };

  useEffect(() => {
    if (!user) return;
    getQuickLogin(user.uid).then((q) => {
      const useBio = !!q?.biometrics;
      setBio(useBio);
      setMode(useBio ? 'bio' : 'pin');
      if (useBio && !asked.current) {
        asked.current = true;
        tryBio();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onPin = async (v: string) => {
    setPin(v);
    setError(null);
    if (!user || v.length < PIN_LENGTH) return;
    const res = await checkPin(user.uid, v);
    if (res === 'ok') setUnlocked(true);
    else if (res === 'locked') {
      setError(`Too many wrong tries. Log in with your password.`);
      await logOut();
    } else {
      setError(`Wrong PIN. After ${MAX_WRONG} wrong tries you will need your password.`);
      setPin('');
    }
  };

  const name = profile?.firstName ?? user?.displayName?.split(' ')[0] ?? '';
  return (
    <Screen>
      <View style={{ backgroundColor: C.navy, paddingTop: 54, paddingBottom: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', alignItems: 'center' }}>
        <HeaderDecor />
        <Robot size={mode === 'pin' ? 84 : 116} intro="wave" mood="happy" />
        <T w={900} size={13} color="#FBBF24" style={{ letterSpacing: 2 }}>METAKNOWIA</T>
        <T w={900} size={24} color="#fff">Welcome back{name ? `, ${name}` : ''}!</T>
        {profile && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <HeaderChip><Icon name="flame" size={15} color="#FB923C" /><T w={900} size={14} color="#fff">{liveStreak(profile)}-day streak</T></HeaderChip>
            <HeaderChip gold><T w={900} size={14} color="#422006">LV {levelInfo(profile.stats.xp).level}</T></HeaderChip>
          </View>
        )}
        {mode === 'pin' && <View style={{ marginTop: 18 }}><PinDots value={pin} error={!!error} /></View>}
      </View>

      {mode === 'bio' ? (
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 30, gap: 8 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Unlock with fingerprint" onPress={tryBio}
            style={{ width: 126, height: 126, borderRadius: 63, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 6, borderBottomColor: C.primary100 }}>
            <Icon name="finger" size={70} color={C.primary} strokeWidth={1.7} />
          </Pressable>
          <T w={900} size={18} style={{ marginTop: 14 }}>Touch the sensor to unlock</T>
          <T w={700} color={C.muted}>{user?.email}</T>
          <View style={{ alignSelf: 'stretch', paddingHorizontal: 20, marginTop: 24, gap: 14, alignItems: 'center' }}>
            <Btn title="Use PIN instead" variant="ghost" small style={{ alignSelf: 'stretch' }} onPress={() => setMode('pin')} />
            <LinkText title="Log in with email & password" onPress={logOut} />
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, paddingTop: 22 }}>
          {error && <T w={800} color={C.danger} style={{ textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 }}>{error}</T>}
          <Keypad value={pin} onChange={onPin} onBiometrics={bio ? tryBio : undefined} />
          <View style={{ alignItems: 'center', marginTop: 22 }}><LinkText title="Forgot PIN? Log in with password" onPress={logOut} /></View>
        </View>
      )}
    </Screen>
  );
}

/** Decorative confetti pieces for celebration headers. */
export function Confetti() {
  const pieces = [
    { l: 30, t: 60, c: '#FBBF24', r: 20 }, { l: 90, t: 120, c: '#F472B6', r: -30 }, { l: 300, t: 70, c: '#34D399', r: 40 },
    { l: 340, t: 140, c: '#FBBF24', r: -10 }, { l: 180, t: 40, c: '#60A5FA', r: 60 }, { l: 250, t: 170, c: '#F472B6', r: 15 },
  ];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0 }} importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => (
        <View key={i} style={{ position: 'absolute', left: p.l, top: p.t, width: 10, height: 16, borderRadius: 3, backgroundColor: p.c, transform: [{ rotate: `${p.r}deg` }] }} />
      ))}
    </View>
  );
}
