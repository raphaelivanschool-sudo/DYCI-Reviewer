import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AvatarView, LevelBadge, XpBar, XpPill } from '@/components/game';
import { Icon, type IconName } from '@/components/Icon';
import { Robot, type RobotHandle } from '@/components/Robot';
import { Btn, Card, HeaderChip, HeaderDecor, LinkText, Screen, Scroll, T, Tile } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { buddyLines } from '@/lib/buddy';
import { claimDaily, useAttempts, useClasses, useExams, useFolders, useReviewers } from '@/lib/db';
import { CHEST_XP, dailyQuests, liveStreak, todayProgress } from '@/lib/game';
import { useLang } from '@/lib/lang';
import { column, useResponsive } from '@/lib/responsive';
import { upcomingItems } from '@/lib/schedule';
import { C } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
}

const QUEST_ICON: Record<string, { icon: IconName; bg: string; fg: string; bar: string }> = {
  check: { icon: 'check', bg: '#DCFCE7', fg: '#16A34A', bar: '#22C55E' },
  target: { icon: 'target', bg: '#EDE9FE', fg: '#7C3AED', bar: '#7C3AED' },
  chat: { icon: 'chat', bg: '#DBEAFE', fg: '#1D4ED8', bar: '#2563EB' },
};

export default function Home() {
  const uid = useUid();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const folders = useFolders(uid).data;
  const reviewers = useReviewers(uid).data;
  if (!profile) return null;

  const inProgress = reviewers.find((r) => r.answered > 0 && r.answered < r.questionCount) ?? reviewers[0];
  const playOrCreate = () =>
    inProgress ? router.push({ pathname: '/briefing/[id]', params: { id: inProgress.id } }) : router.push('/add-reviewer');
  // Tapping a quest opens the place where it can be done.
  const QUEST_ACTION: Record<string, { go: () => void; hint: string }> = {
    answer10: { go: playOrCreate, hint: inProgress ? 'Opens your reviewer' : 'Make a reviewer first' },
    score80: { go: playOrCreate, hint: inProgress ? 'Opens your reviewer' : 'Make a reviewer first' },
    ask1: { go: () => router.push('/chat'), hint: 'Opens the chat' },
  };
  const quests = dailyQuests(profile);
  const today = todayProgress(profile);
  const allClaimed = quests.every((q) => today.claimed.includes(q.id));

  return (
    <Screen>
      <View style={{ backgroundColor: C.navy, paddingTop: insets.top + 8, paddingBottom: 18, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <HeaderDecor />
        <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.navigate('/profile')}>
            <AvatarView avatar={profile.avatar} outfit={profile.outfit} size={48} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <T w={700} size={13.5} color="#BFDBFE">{greeting()}</T>
            <T w={900} size={24} color="#fff">{profile.firstName}!</T>
          </View>
          <HeaderChip><Icon name="star" size={16} color="#FBBF24" /><T w={900} size={14} color="#fff">{profile.stats.xp ?? 0}</T></HeaderChip>
        </View>
        {/* Tapping the level opens the rewards road (a prize for every level). */}
        <Pressable accessibilityRole="button" accessibilityLabel="See level rewards" onPress={() => router.push('/rewards')}
          style={[column, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14 }]}>
          <LevelBadge xp={profile.stats.xp} />
          <XpBar xp={profile.stats.xp} />
          <Icon name="gift" size={22} color="#FBBF24" />
        </Pressable>
      </View>

      <Scroll style={{ paddingTop: 14 }} bottom={24}>
        <BuddyCard />

        <UpcomingCard />

        {inProgress ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Continue ${inProgress.title}`} onPress={() => router.push({ pathname: '/briefing/[id]', params: { id: inProgress.id } })}
            style={{ backgroundColor: C.navy, borderRadius: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 5, borderBottomColor: '#172E6E', marginBottom: 4 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="play" color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <T w={900} size={11.5} color="#FBBF24" style={{ letterSpacing: 0.5 }}>
                {inProgress.answered > 0 && inProgress.answered < inProgress.questionCount ? 'CONTINUE' : 'PLAY'} · {(folders.find((f) => f.id === inProgress.folderId)?.name ?? 'No subject').toUpperCase()}
              </T>
              <T w={900} color="#fff" numberOfLines={1}>{inProgress.title}</T>
              <View style={{ height: 8, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 6, overflow: 'hidden' }}>
                <View style={{ width: `${(inProgress.answered / Math.max(1, inProgress.questionCount)) * 100}%`, height: '100%', backgroundColor: '#FBBF24', borderRadius: 99 }} />
              </View>
            </View>
          </Pressable>
        ) : (
          <Btn title="Make my first reviewer" icon="sparkles" variant="gold" onPress={() => router.push('/add-reviewer')} />
        )}

        <Card style={{ marginTop: 14, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <T w={900} size={16}>Daily quests</T>
            {allClaimed && !today.claimed.includes('chest') ? (
              <Btn small variant="gold" icon="gift" title={`Open chest +${CHEST_XP}`} onPress={() => claimDaily(uid, 'chest')} style={{ minHeight: 36, paddingHorizontal: 10 }} />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.amber50, paddingHorizontal: 8, height: 26, borderRadius: 99 }}>
                <Icon name="gift" size={13} color="#B45309" />
                <T w={900} size={12} color="#B45309">{today.claimed.includes('chest') ? 'Chest opened' : `Chest at ${quests.filter((q) => today.claimed.includes(q.id)).length}/3`}</T>
              </View>
            )}
          </View>
          {quests.map((q, i) => {
            const st = QUEST_ICON[q.icon];
            const done = q.value >= q.goal;
            const claimed = today.claimed.includes(q.id);
            const action = QUEST_ACTION[q.id];
            return (
              <Pressable key={q.id} accessibilityRole="button" accessibilityLabel={`${q.title}. ${claimed ? 'Claimed' : done ? 'Done, claim your XP' : action?.hint ?? ''}`}
                disabled={claimed || done || !action} onPress={action?.go}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: '#EEF2F7', opacity: pressed ? 0.6 : 1 })}>
                <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: st.bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={st.icon} color={st.fg} /></View>
                <View style={{ flex: 1 }}>
                  <T w={800} size={14.5}>{q.title}</T>
                  <View style={{ height: 9, borderRadius: 99, backgroundColor: '#EEF2F7', overflow: 'hidden', marginTop: 6 }}>
                    <View style={{ width: `${(q.value / q.goal) * 100}%`, height: '100%', backgroundColor: st.bar, borderRadius: 99 }} />
                  </View>
                </View>
                {claimed ? <T w={900} size={12.5} color={C.muted}>CLAIMED</T> : done ? (
                  <Btn small variant="gold" title={`+${q.xp}`} onPress={() => claimDaily(uid, q.id)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                    <XpPill xp={q.xp} />
                    <Icon name="right" size={16} color={C.faint} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </Card>

      </Scroll>
    </Screen>
  );
}

/** Re-renders every minute so classes that just ended drop off the list. */
function useMinuteClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Today's classes that have not ended yet + upcoming exams. Nothing left → "No class or exam". */
function UpcomingCard() {
  const uid = useUid();
  const { data: classes, loading } = useClasses(uid);
  const exams = useExams(uid).data;
  const now = useMinuteClock();
  const items = upcomingItems(classes, exams, now);
  const shown = items.slice(0, 4);

  if (!loading && !classes.length && !exams.length)
    return (
      <Card label="Add my class schedule" onPress={() => router.push('/schedule/scan')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingVertical: 12 }}>
        <Tile icon="camera" tint="amber" />
        <View style={{ flex: 1 }}>
          <T w={800} size={15}>Add your class schedule</T>
          <T w={600} size={13} color={C.muted}>Snap a photo, get class reminders.</T>
        </View>
        <Icon name="right" color={C.faint} />
      </Card>
    );

  return (
    <Card style={{ marginBottom: 12, paddingVertical: 12, borderWidth: 2, borderColor: '#FDE68A', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name="calendar" size={18} color={C.amber800} />
        <T w={900} size={13} color={C.amber800} style={{ flex: 1, letterSpacing: 0.5 }}>UPCOMING</T>
        <LinkText title="Schedule" onPress={() => router.navigate('/schedule')} />
      </View>
      {shown.length === 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: C.success50, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check" color={C.success700} />
          </View>
          <View style={{ flex: 1 }}>
            <T w={900} size={15.5}>No class or exam</T>
            <T w={600} size={13} color={C.muted}>You’re free for the rest of today. Good time to review!</T>
          </View>
        </View>
      ) : (
        shown.map((it) => (
          <Pressable key={it.key} accessibilityRole="button" accessibilityLabel={`${it.kind === 'exam' ? 'Exam' : 'Class'}: ${it.title}, ${it.sub}, ${it.when}`}
            onPress={() => (it.kind === 'exam' ? router.push({ pathname: '/exam/[id]', params: { id: it.id } }) : router.navigate({ pathname: '/schedule', params: { tab: 'classes' } }))}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 99, backgroundColor: it.color }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ backgroundColor: it.kind === 'exam' ? '#FEE2E2' : C.primary50, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 }}>
                  <T w={900} size={10.5} color={it.kind === 'exam' ? '#B91C1C' : C.primary700}>{it.kind === 'exam' ? 'EXAM' : 'CLASS'}</T>
                </View>
                <T w={800} size={15} numberOfLines={1} style={{ flex: 1 }}>{it.title}</T>
              </View>
              <T w={600} size={12.5} color={C.muted} numberOfLines={1}>{it.sub}</T>
            </View>
            <View style={{ backgroundColor: it.now ? C.success50 : '#FFF7ED', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 3 }}>
              <T w={900} size={12} color={it.now ? C.success700 : '#C2410C'}>{it.when}</T>
            </View>
          </Pressable>
        ))
      )}
      {items.length > shown.length && <T w={700} size={12.5} color={C.muted}>+{items.length - shown.length} more in Schedule</T>}
    </Card>
  );
}

/** METANOIA on Home: changing moods and lines, tap to chat, streak button opens My Journey. */
function BuddyCard() {
  const uid = useUid();
  const { profile } = useAuth();
  const classes = useClasses(uid).data;
  const exams = useExams(uid).data;
  const lang = useLang();
  const lastAttempt = useAttempts(uid, undefined, 1).data[0];
  const robot = useRef<RobotHandle>(null);
  const { compact } = useResponsive();
  const [i, setI] = useState(0);
  const lines = profile ? buddyLines(profile, classes, exams, lastAttempt, lang) : [];
  const line = lines[i % Math.max(1, lines.length)];

  useEffect(() => {
    const t = setInterval(() => setI((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (line) robot.current?.play(line.gesture);
    // Play the gesture when the line changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, line?.text]);

  if (!profile || !line) return null;
  const streak = liveStreak(profile);
  // Fixed sizes: the card, the robot and the bubble never change size when METANOIA's line changes,
  // so nothing below the card jumps. Long lines get a smaller font instead of a taller bubble.
  const robotSize = compact ? 104 : 128;
  const cardHeight = compact ? 196 : 214;
  const textSize = line.text.length > 90 ? 12.5 : line.text.length > 60 ? 13.5 : 14.5;
  return (
    <View style={{ height: cardHeight, backgroundColor: '#fff', borderRadius: 26, marginBottom: 12, overflow: 'hidden', borderBottomWidth: 4, borderBottomColor: C.line }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 52, backgroundColor: C.primary50 }} />
      <Pressable accessibilityRole="button" accessibilityLabel={`METANOIA says: ${line.text}. Tap to chat`} onPress={() => router.push('/chat')} style={StyleSheet.absoluteFill}>
        <View style={{ position: 'absolute', left: 6, bottom: 8 }}>
          <Robot ref={robot} size={robotSize} outfit={profile.outfit} mood={line.mood} intro="wave" />
        </View>
        <View style={{ position: 'absolute', left: 12, bottom: 10, backgroundColor: C.success50, borderRadius: 99, paddingHorizontal: 9, height: 22, justifyContent: 'center' }}>
          <T w={900} size={11} color={C.success700} numberOfLines={1}>Mood: {line.mood}</T>
        </View>
        <View style={{ position: 'absolute', left: robotSize + 10, right: 12, top: 54, bottom: 12 }}>
          {/* The old and new bubbles fade on top of each other inside a fixed box. */}
          <View style={{ flex: 1 }}>
            <Animated.View key={line.text} entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, borderColor: C.line, borderBottomWidth: 4, justifyContent: 'center' }}>
              <T w={800} size={textSize} numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.8}>{line.text}</T>
            </Animated.View>
          </View>
          <View style={{ height: 30, flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <Icon name="chat" size={15} color={C.primary700} />
            <T w={900} size={13} color={C.primary700} numberOfLines={1} style={{ flexShrink: 1 }}>{lang === 'tl' ? 'I-tap para mag-chat' : 'Tap me to chat'}</T>
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`${streak}-day streak. Open My Journey`} onPress={() => router.push('/journey')}
        style={{ position: 'absolute', right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFF7ED', borderWidth: 2, borderColor: '#FED7AA', borderBottomWidth: 4, borderRadius: 99, paddingHorizontal: 10, height: 34 }}>
        <Icon name="flame" size={17} color="#EA580C" />
        <T w={900} color="#C2410C">{streak} {streak === 1 ? 'day' : 'days'}</T>
        <Icon name="right" size={14} color="#C2410C" />
      </Pressable>
    </View>
  );
}
