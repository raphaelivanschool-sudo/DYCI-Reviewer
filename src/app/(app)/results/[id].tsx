import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti } from '@/components/AccountGates';
import { StarsRow } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Btn, Card, Footer, HeaderDecor, Loading, Screen, Scroll, Section, T } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { useAttempts } from '@/lib/db';
import { levelInfo, liveStreak, nextReward, starsFor } from '@/lib/game';
import { QUESTION_TYPES } from '@/lib/question-types';
import { C } from '@/theme';

const badgeName = (b: string) => (b.startsWith('topic:') ? `Topic Master: ${b.slice(6)}` : b === 'first-step' ? 'First Step' : b);

export default function Results() {
  const { id, badges } = useLocalSearchParams<{ id: string; badges?: string }>();
  const uid = useUid();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const attempt = useAttempts(uid, undefined, 20).data.find((a) => a.id === id);
  if (!attempt || !profile) return <Loading />;

  const stars = attempt.stars ?? starsFor(attempt.percent);
  const cleared = stars > 0;
  const lvl = levelInfo(profile.stats.xp);
  const reward = nextReward(profile.stats.xp);
  const newBadges = (badges ?? '').split('|').filter(Boolean);
  const topics = Object.entries(attempt.byTopic)
    .map(([name, t]) => ({ name, pct: Math.round((t.correct / t.total) * 100), ...t }))
    .sort((a, b) => a.pct - b.pct);
  const weak = topics.find((t) => t.pct < 75);


  return (
    <Screen>
      <View style={{ backgroundColor: cleared ? C.navy : '#9F1239', paddingTop: insets.top + 12, paddingBottom: 24, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', alignItems: 'center' }}>
        <HeaderDecor />
        {cleared && <Confetti />}
        <T w={900} size={14} color="#FBBF24" style={{ letterSpacing: 1.5 }}>{cleared ? 'STAGE CLEAR!' : 'ALMOST THERE!'}</T>
        <View style={{ marginVertical: 8 }}><StarsRow stars={stars} size={56} /></View>
        <T w={900} size={46} color="#fff">{attempt.percent}%</T>
        <T w={700} color="#BFDBFE">{attempt.correct} of {attempt.total} correct · {attempt.reviewerTitle}</T>
      </View>

      <Scroll style={{ paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat value={`+${attempt.xpEarned ?? 0}`} label="XP earned" color="#B45309" />
          <Stat value={`×${attempt.bestCombo ?? 0}`} label="Best combo" color="#7C3AED" />
          <Stat value={String(liveStreak(profile))} label="Day streak" color="#C2410C" icon />
        </View>

        <Card style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T w={800}>Level {lvl.level} → <T w={900} color="#B45309">Level {lvl.level + 1}</T></T>
            <T w={800} color={C.muted}>{lvl.into} / {lvl.need}</T>
          </View>
          <View style={{ height: 14, borderRadius: 99, backgroundColor: '#EEF2F7', overflow: 'hidden', marginTop: 8 }}>
            <View style={{ width: `${(lvl.into / lvl.need) * 100}%`, height: '100%', borderRadius: 99, backgroundColor: '#FBBF24' }} />
          </View>
          <T w={700} size={12.5} color={C.muted} style={{ marginTop: 6 }}>{lvl.toNext} XP more to level up!</T>
          {reward && (
            <T w={700} size={12.5} color={C.muted} onPress={() => router.push('/rewards')}>
              Next reward: <T w={900} size={12.5} color="#B45309">{reward.label}</T> at Level {reward.level}
            </T>
          )}
        </Card>

        {newBadges.map((b) => (
          <View key={b} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EDE9FE', borderWidth: 2, borderColor: '#C4B5FD', borderRadius: 20, padding: 12 }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: '#5B21B6' }}>
              <Icon name="trophy" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <T w={900} size={11.5} color="#7C3AED" style={{ letterSpacing: 0.5 }}>NEW BADGE UNLOCKED</T>
              <T w={900} size={16}>{badgeName(b)}</T>
            </View>
          </View>
        ))}

        {Object.keys(attempt.byType ?? {}).length > 1 && (
          <Section title="Score per type">
            <Card style={{ gap: 10 }}>
              {QUESTION_TYPES.filter((t) => attempt.byType?.[t.id]).map((t) => {
                const s = attempt.byType![t.id];
                const pct = s.total ? s.correct / s.total : 0;
                return (
                  <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T w={800}>{t.label}</T>
                    <T w={900} color={pct >= 0.75 ? C.success700 : pct >= 0.5 ? '#B45309' : '#B91C1C'}>{s.correct} / {s.total}</T>
                  </View>
                );
              })}
            </Card>
          </Section>
        )}

        <Section title="Score by topic">
          <Card style={{ gap: 14 }}>
            {topics.map((t) => (
              <View key={t.name} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T w={700}>{t.name}</T>
                  <T w={800} color={t.pct >= 75 ? C.success700 : t.pct >= 50 ? '#B45309' : '#B91C1C'}>{t.correct}/{t.total}</T>
                </View>
                <View style={{ height: 10, borderRadius: 99, backgroundColor: '#EEF2F7', overflow: 'hidden' }}>
                  <View style={{ width: `${t.pct}%`, height: '100%', borderRadius: 99, backgroundColor: t.pct >= 75 ? '#22C55E' : t.pct >= 50 ? '#FBBF24' : C.danger }} />
                </View>
              </View>
            ))}
          </Card>
        </Section>

        <Card style={{ marginTop: 16, backgroundColor: '#EEF4FF', gap: 10, borderBottomWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Robot size={52} outfit={profile.outfit} intro={cleared ? 'cheer' : 'think'} mood={cleared ? 'proud' : 'worried'} />
            <T w={900} size={17}>Tips from METANOIA</T>
          </View>
          <T color={C.ink2}>
            {weak
              ? `Review "${weak.name}" again: you got ${weak.correct} of ${weak.total}. Read the explanations, then try once more.`
              : 'You know this lesson well! Try a harder stage or teach a friend to lock it in.'}
          </T>
          {weak && <Btn small variant="soft" icon="chat" title={`Ask about ${weak.name}`} onPress={() => router.push({ pathname: '/chat', params: { ask: `Explain ${weak.name} in a simpler way` } })} />}
        </Card>
      </Scroll>
      <Footer row>
        <Btn title="Retry" variant="ghost" style={{ flex: 1 }} onPress={() => router.replace({ pathname: '/briefing/[id]', params: { id: attempt.reviewerId } })} />
        <Btn title="Dashboard" icon="home" variant="gold" style={{ flex: 1.4 }} onPress={() => router.dismissTo('/home')} />
      </Footer>
    </Screen>
  );
}

function Stat({ value, label, color, icon }: { value: string; label: string; color: string; icon?: boolean }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <T w={900} size={20} color={color}>{value}</T>
        {icon && <Icon name="flame" size={18} color="#EA580C" />}
      </View>
      <T w={800} size={12} color={C.muted}>{label}</T>
    </Card>
  );
}
