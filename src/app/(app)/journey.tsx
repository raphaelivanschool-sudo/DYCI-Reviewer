import { View } from 'react-native';

import { XpPill } from '@/components/game';
import { Icon, type IconName } from '@/components/Icon';
import { Btn, Card, Header, Screen, Scroll, Section, T } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { claimReward, useAttempts } from '@/lib/db';
import { journeyGoals, liveStreak, localDay, STREAK_MILESTONES } from '@/lib/game';
import { C } from '@/theme';

const GOAL_STYLE: Record<string, { icon: IconName; bg: string; fg: string; bar: string }> = {
  flame: { icon: 'flame', bg: '#FFEDD5', fg: '#C2410C', bar: '#FB923C' },
  gift: { icon: 'gift', bg: '#FEF3C7', fg: '#B45309', bar: '#FBBF24' },
  target: { icon: 'target', bg: '#EDE9FE', fg: '#7C3AED', bar: '#7C3AED' },
  star: { icon: 'star', bg: '#FEF3C7', fg: '#B45309', bar: '#FBBF24' },
};

/** Streak, streak road and claimable goals (opened from the streak on the Home buddy card). */
export default function Journey() {
  const uid = useUid();
  const { profile } = useAuth();
  const attempts = useAttempts(uid, undefined, 100).data;
  if (!profile) return null;

  const streak = liveStreak(profile);
  const goals = journeyGoals(profile, attempts);
  const claimed = new Set(profile.claimed ?? []);

  // Days of this week (Mon–Sun) that have at least one finished stage.
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const studied = new Set(attempts.filter((a) => a.createdAt).map((a) => localDay(a.createdAt!.toDate())));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label: 'MTWTFSS'[i], on: studied.has(localDay(d)), today: localDay(d) === localDay() };
  });

  const nextMilestone = STREAK_MILESTONES.find((m) => m > streak) ?? STREAK_MILESTONES[STREAK_MILESTONES.length - 1];
  const road = [...STREAK_MILESTONES.filter((m) => m <= streak).slice(-1), 'today' as const, ...STREAK_MILESTONES.filter((m) => m > streak).slice(0, 2)];

  return (
    <Screen>
      <Header title="My Journey" sub={streak ? 'Keep the fire going!' : 'Study today to start a streak'}
        right={<View style={{ alignItems: 'center' }}><Icon name="flame" size={40} color="#FDBA74" /><T w={900} size={13} color="#fff">{streak} {streak === 1 ? 'day' : 'days'}</T></View>}>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingTop: 12 }}>
          {week.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <T w={900} size={11} color="#BFDBFE">{d.label}</T>
              <View style={{ alignSelf: 'stretch', height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: d.on ? '#FFEDD5' : 'rgba(255,255,255,0.15)', borderWidth: d.today ? 3 : 0, borderColor: '#FBBF24' }}>
                {d.on && <Icon name="flame" size={16} color="#EA580C" />}
              </View>
            </View>
          ))}
        </View>
      </Header>
      <Scroll>
        <Section title="Streak road" style={{ marginTop: 0 }}>
          <Card style={{ paddingTop: 18, paddingBottom: 30 }}>
            <View style={{ position: 'absolute', left: 50, right: 50, top: 48, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              {road.map((n, i) => {
                const isToday = n === 'today';
                const done = !isToday && n <= streak;
                return (
                  <View key={i} style={{ alignItems: 'center', width: 70 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 5,
                      backgroundColor: isToday ? '#FBBF24' : done ? '#22C55E' : '#CBD5E1', borderBottomColor: isToday ? '#B45309' : done ? '#15803D' : '#94A3B8' }}>
                      {isToday ? <Icon name="flame" color="#422006" /> : n === 7 && !done ? <Icon name="gift" color="#64748B" /> : <T w={900} size={18} color={done ? '#fff' : '#64748B'}>{n}</T>}
                    </View>
                    <T w={800} size={11.5} color={C.ink2} style={{ marginTop: 6 }}>{isToday ? `Today · ${streak}` : `Day ${n}`}</T>
                  </View>
                );
              })}
            </View>
            <T w={700} size={13} color={C.muted} style={{ textAlign: 'center', marginTop: 14 }}>
              {nextMilestone - streak} more {nextMilestone - streak === 1 ? 'day' : 'days'} to reach a {nextMilestone}-day streak
            </T>
          </Card>
        </Section>

        <Section title="Goals & rewards">
          <Card style={{ paddingVertical: 6 }}>
            {goals.map((g, i) => {
              const st = GOAL_STYLE[g.icon];
              const done = g.value >= g.goal;
              const isClaimed = claimed.has(g.key);
              return (
                <View key={g.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: '#EEF2F7' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={done ? 'check' : st.icon} color={done ? C.success : st.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T w={800} size={14.5}>{g.title}</T>
                    <View style={{ height: 9, borderRadius: 99, backgroundColor: '#EEF2F7', overflow: 'hidden', marginTop: 6 }}>
                      <View style={{ width: `${(g.value / g.goal) * 100}%`, height: '100%', backgroundColor: done ? '#22C55E' : st.bar, borderRadius: 99 }} />
                    </View>
                    <T w={700} size={12} color={C.muted} style={{ marginTop: 3 }}>{g.goal > 1 ? `${g.value} / ${g.goal} · ` : ''}{g.detail}</T>
                  </View>
                  {isClaimed ? (
                    <View style={{ backgroundColor: '#EEF2F7', borderRadius: 12, paddingHorizontal: 10, height: 36, justifyContent: 'center' }}><T w={900} size={12.5} color={C.muted}>CLAIMED</T></View>
                  ) : done ? (
                    <Btn small variant="gold" title={`Claim +${g.xp}`} onPress={() => claimReward(uid, g.key, g.xp)} style={{ minHeight: 38, paddingHorizontal: 10 }} />
                  ) : (
                    <XpPill xp={g.xp} />
                  )}
                </View>
              );
            })}
          </Card>
        </Section>
      </Scroll>
    </Screen>
  );
}
