import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarPicker } from '@/components/AvatarPicker';
import { AvatarView } from '@/components/game';
import { Icon, type IconName } from '@/components/Icon';
import { TimePicker } from '@/components/TimePicker';
import { Btn, Card, GroupLabel, HeaderChip, HeaderDecor, Screen, Scroll, T, Toggle } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { confirmAction } from '@/lib/confirm';
import { updateProfileFields, useClasses, useReviewers } from '@/lib/db';
import { levelInfo, liveStreak, nextReward } from '@/lib/game';
import { scheduleDailyStudyReminder } from '@/lib/notifications';
import { disableQuickLogin, getQuickLogin, quickLoginSupported } from '@/lib/quick-login';
import { fmtTime } from '@/lib/schedule';
import { C } from '@/theme';

const badgeName = (b: string) => (b.startsWith('topic:') ? `Topic Master: ${b.slice(6)}` : b === 'first-step' ? 'First Step' : b);

export default function Profile() {
  const uid = useUid();
  const { profile, logOut } = useAuth();
  const insets = useSafeAreaInsets();
  const reviewers = useReviewers(uid).data;
  const classes = useClasses(uid).data;
  const [picker, setPicker] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [ql, setQl] = useState<'unsupported' | 'off' | 'on'>('unsupported');

  // Re-read quick login state whenever Profile is shown (it may have just been set up).
  useFocusEffect(
    useCallback(() => {
      quickLoginSupported().then(async (ok) => {
        if (!ok) return setQl('unsupported');
        setQl((await getQuickLogin(uid))?.pinHash ? 'on' : 'off');
      });
    }, [uid]),
  );

  if (!profile) return null;

  const { stats } = profile;
  const avg = stats.attempts ? Math.round(stats.totalPercent / stats.attempts) : null;
  const fullName = [profile.firstName, profile.middleName, profile.lastName].filter(Boolean).join(' ');
  const lvl = levelInfo(stats.xp);
  const next = nextReward(stats.xp);
  const badges = profile.badges ?? [];

  const dailyTime = profile.dailyReminderTime ?? 19;
  const toggleDaily = async (on: boolean) => {
    await updateProfileFields(uid, { dailyReminderOn: on });
    await scheduleDailyStudyReminder(on, dailyTime).catch(() => {});
  };
  const setDailyTime = async (time: number) => {
    setTimeOpen(false);
    await updateProfileFields(uid, { dailyReminderTime: time, dailyReminderOn: true });
    await scheduleDailyStudyReminder(true, time).catch(() => {});
  };

  const turnOffQuickLogin = () =>
    confirmAction('Turn off quick login?', 'You will log in with your email and password next time.', 'Turn off', async () => {
      await disableQuickLogin(uid);
      setQl('off');
    });

  return (
    <Screen>
      <View style={{ backgroundColor: C.navy, paddingTop: insets.top + 14, paddingBottom: 22, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', alignItems: 'center' }}>
        <HeaderDecor />
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture" onPress={() => setPicker(true)}>
          <AvatarView avatar={profile.avatar} outfit={profile.outfit} size={96} />
          <View style={{ position: 'absolute', right: -2, bottom: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="camera" size={15} color="#fff" />
          </View>
        </Pressable>
        <T w={900} size={22} color="#fff" style={{ marginTop: 8 }}>{fullName}</T>
        <T w={700} size={13.5} color="#BFDBFE">{profile.email}</T>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <HeaderChip gold><T w={900} size={13.5} color="#422006">LV {lvl.level} {lvl.title}</T></HeaderChip>
          <HeaderChip><Icon name="cap" size={15} color="#fff" /><T w={900} size={13.5} color="#fff">{profile.gradeLevel}</T></HeaderChip>
        </View>
      </View>

      <Scroll style={{ paddingTop: 14 }}>
        <Card style={{ flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 6 }}>
          <Stat value={String(reviewers.length)} label="Lessons" />
          <Stat value={avg === null ? '–' : `${avg}%`} label="Avg. score" border />
          <Stat value={String(liveStreak(profile))} label="Day streak" icon="flame" />
        </Card>

        <GroupLabel>{`Badges · ${badges.length}`}</GroupLabel>
        {badges.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {badges.map((b) => (
              <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EDE9FE', borderRadius: 99, paddingHorizontal: 10, height: 32 }}>
                <Icon name="trophy" size={15} color="#7C3AED" />
                <T w={800} size={13} color="#5B21B6">{badgeName(b)}</T>
              </View>
            ))}
          </View>
        ) : (
          <T w={600} color={C.muted}>Finish stages to earn badges.</T>
        )}

        <GroupLabel>Planner & buddy</GroupLabel>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row icon="flame" title="My Journey" sub="Streak, goals and rewards" onPress={() => router.push('/journey')} />
          <Row icon="gift" title="Level rewards" sub={next ? `Next: ${next.label} at Level ${next.level}` : 'All rewards unlocked!'} onPress={() => router.push('/rewards')} />
          <Row icon="calendar" title="My class schedule" sub={classes.length ? `${new Set(classes.map((c) => c.subject)).size} subjects · reminders ${profile.remindersOn ? 'on' : 'off'}` : 'Not set up yet'} onPress={() => router.navigate({ pathname: '/schedule', params: { tab: 'classes' } })} />
          <Row icon="shirt" title="My METANOIA buddy" sub="Outfits and gestures" onPress={() => router.push('/buddy')} last />
        </Card>

        <GroupLabel>Study</GroupLabel>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Row icon="clock" title="Daily study reminder" sub={profile.dailyReminderOn ? `Every day at ${fmtTime(dailyTime)}` : 'Off'}
            right={<Toggle label="Daily study reminder" value={profile.dailyReminderOn} onChange={toggleDaily} />} />
          <Row icon="edit" title="Reminder time" sub="Pick the time that fits your day" onPress={() => setTimeOpen(true)}
            right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><T w={900} color={C.primary700}>{fmtTime(dailyTime)}</T><Icon name="right" color={C.faint} /></View>} last />
        </Card>

        {ql !== 'unsupported' && (
          <>
            <GroupLabel>Security</GroupLabel>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {ql === 'on' ? (
                <>
                  <Row icon="finger" title="Change PIN / fingerprint" sub="Quick login is on" onPress={() => router.push('/quick-login')} />
                  <Row icon="lock" title="Turn off quick login" sub="Use email and password instead" onPress={turnOffQuickLogin} last />
                </>
              ) : (
                <Row icon="finger" title="Set up quick login" sub="Unlock with fingerprint or a 4-digit PIN" onPress={() => router.push('/quick-login')} last />
              )}
            </Card>
          </>
        )}

        <Btn title="Log out" icon="logout" variant="ghost" textColor={C.danger} style={{ marginTop: 24 }} onPress={() => confirmAction('Log out?', undefined, 'Log out', logOut)} />
        <T size={12.5} color={C.muted} style={{ textAlign: 'center', marginTop: 12 }}>METAKNOWIA v1.1</T>
      </Scroll>
      <AvatarPicker uid={uid} profile={profile} visible={picker} onClose={() => setPicker(false)} />
      <TimePicker visible={timeOpen} value={dailyTime} title="Daily study reminder" presets={[6, 12, 16, 19, 20, 21]} onClose={() => setTimeOpen(false)} onSave={setDailyTime} />
    </Screen>
  );
}

function Stat({ value, label, border, icon }: { value: string; label: string; border?: boolean; icon?: IconName }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: border ? 1 : 0, borderRightWidth: border ? 1 : 0, borderColor: C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon && <Icon name={icon} size={20} color="#C2410C" />}
        <T w={900} size={22}>{value}</T>
      </View>
      <T w={700} size={13} color={C.muted}>{label}</T>
    </View>
  );
}

function Row({ icon, title, sub, onPress, right, last }: { icon: IconName; title: string; sub?: string; onPress?: () => void; right?: React.ReactNode; last?: boolean }) {
  const body = (
    <>
      <Icon name={icon} color={C.muted} />
      <View style={{ flex: 1 }}>
        <T w={800}>{title}</T>
        {sub ? <T w={600} size={13.5} color={C.muted}>{sub}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="right" color={C.faint} /> : null)}
    </>
  );
  const style = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14, minHeight: 58, paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderBottomColor: C.line };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: C.bg }]}>{body}</Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}
