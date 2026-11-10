import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Robot } from '@/components/Robot';
import { Btn, Field, HeaderDecor, LinkText, Screen, Scroll, T } from '@/components/ui';
import { authErrorMessage, useAuth } from '@/lib/auth-context';
import { notify } from '@/lib/confirm';
import { C } from '@/theme';

export default function Login() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return setError('Type your email and password.');
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) return setError('Type your email first, then tap "Forgot password?".');
    try {
      await resetPassword(email);
      notify('Check your email', 'We sent a link to reset your password.');
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ backgroundColor: C.navy, paddingTop: 54, paddingBottom: 26, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden', alignItems: 'center', marginBottom: 20 }}>
          <HeaderDecor />
          <Robot size={112} intro="wave" mood="happy" />
          <T w={900} size={14} color="#FBBF24" style={{ letterSpacing: 2.5, marginTop: 4 }}>METAKNOWIA</T>
          <T w={900} size={26} color="#fff">Welcome back!</T>
          <T w={700} color="#BFDBFE">Log in to continue your adventure.</T>
        </View>
        <Scroll>

          <View style={{ gap: 16 }}>
            <Field label="Email" icon="mail" value={email} onChangeText={setEmail} placeholder="juan@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            <Field label="Password" icon="lock" value={password} onChangeText={setPassword} placeholder="••••••••" secure autoComplete="password" textContentType="password" onSubmitEditing={submit} />
            <View style={{ alignSelf: 'flex-end', marginTop: -6 }}>
              <LinkText title="Forgot password?" onPress={forgot} />
            </View>
            {error && <T w={700} color={C.danger}>{error}</T>}
            <Btn title="Log in" onPress={submit} loading={busy} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 24 }}>
            <T w={600} color={C.muted}>New here?</T>
            <LinkText title="Create an account" onPress={() => router.push('/signup')} />
          </View>
        </Scroll>
      </KeyboardAvoidingView>
    </Screen>
  );
}
