import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Btn, Card, Checkbox, Chip, Field, Footer, Header, LinkText, Screen, Scroll, StepBar, T } from '@/components/ui';
import { authErrorMessage, useAuth } from '@/lib/auth-context';
import { passwordCheck } from '@/lib/password';
import type { GradeLevel } from '@/lib/types';
import { C } from '@/theme';

const GRADES: GradeLevel[] = ['Elementary', 'High School', 'Senior High', 'College'];

export default function SignUp() {
  const { signUp } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [grade, setGrade] = useState<GradeLevel>('High School');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const pw = passwordCheck(password);
  const match = confirm.length > 0 && confirm === password;
  const ready = agreed && pw.ok && match;

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Type your first name.';
    if (!lastName.trim()) e.lastName = 'Type your last name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = 'Type a valid email.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await signUp({ firstName, middleName, lastName, email, password, gradeLevel: grade });
      // The app layout now shows "Check your email" until the 6-digit code is entered.
    } catch (err) {
      setFormError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Create your account" sub="Step 1 of 3 · Player profile" onBack={() => router.replace('/login')}
          right={<Robot size={60} intro="wave" />}>
          <StepBar step={1} />
        </Header>
        <Scroll>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="Juan" autoComplete="given-name" textContentType="givenName" error={errors.firstName} /></View>
              <View style={{ flex: 1 }}><Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Dela Cruz" autoComplete="family-name" textContentType="familyName" error={errors.lastName} /></View>
            </View>
            <Field label="Middle name" optional value={middleName} onChangeText={setMiddleName} placeholder="Leave blank if none" autoComplete="additional-name" textContentType="middleName" />
            <Field label="Email" icon="mail" value={email} onChangeText={setEmail} placeholder="juan@email.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />

            <View style={{ gap: 8 }}>
              <T w={800} size={14.5} color={C.ink2}>What grade level are you in?</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {GRADES.map((g) => <Chip key={g} title={g} on={grade === g} onPress={() => setGrade(g)} style={{ width: '48.5%', borderRadius: 14 }} />)}
              </View>
            </View>

            <Field label="Password" icon="lock" value={password} onChangeText={setPassword} placeholder="Make it strong" secure autoComplete="new-password" textContentType="newPassword" />
            <Card style={{ paddingVertical: 12, paddingHorizontal: 14, marginTop: -6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T w={800} size={13}>Password strength</T>
                <T w={800} size={13} color={password ? pw.color : C.muted}>{pw.label}</T>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginVertical: 9 }} accessibilityLabel={`${pw.passed} of 5 password rules met`}>
                {pw.results.map((r, i) => <View key={r.id} style={{ flex: 1, height: 8, borderRadius: 99, backgroundColor: i < pw.passed ? pw.color : C.line }} />)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 }}>
                {pw.results.map((r) => (
                  <View key={r.id} style={{ width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: r.ok ? '#22C55E' : '#EEF2F7' }}>
                      <Icon name={r.ok ? 'check' : 'x'} size={11} color={r.ok ? '#fff' : C.muted} strokeWidth={3.4} />
                    </View>
                    <T w={700} size={13} color={r.ok ? C.success700 : C.muted}>{r.label}</T>
                  </View>
                ))}
              </View>
            </Card>
            <Field label="Confirm password" icon="lock" value={confirm} onChangeText={setConfirm} placeholder="Type it again" secure autoComplete="new-password"
              error={confirm && !match ? 'Passwords do not match.' : null} hint={match ? 'Passwords match.' : undefined} />

            <Checkbox checked={agreed} onChange={setAgreed}>
              <T w={600} color={C.ink2}>I agree to the <T w={800} color={C.primary700} accessibilityRole="link" onPress={() => router.push('/terms')} style={{ textDecorationLine: 'underline' }}>Terms</T> and <T w={800} color={C.primary700} accessibilityRole="link" onPress={() => router.push('/privacy')} style={{ textDecorationLine: 'underline' }}>Privacy Policy</T></T>
            </Checkbox>
            {formError && <T w={700} color={C.danger}>{formError}</T>}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22 }}>
            <T w={600} color={C.muted}>Already have an account?</T>
            <LinkText title="Log in" onPress={() => router.replace('/login')} />
          </View>
        </Scroll>
        <Footer>
          <Btn title="Create account" onPress={submit} disabled={!ready} loading={busy} />
          {!ready && (
            <T size={13} color={C.muted} style={{ textAlign: 'center', marginTop: 8 }}>
              {!pw.ok ? 'Complete all 5 password rules to continue' : !match ? 'Confirm your password to continue' : 'Agree to the Terms to continue'}
            </T>
          )}
        </Footer>
      </KeyboardAvoidingView>
    </Screen>
  );
}
