import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { Btn, Card, Footer, Header, HeaderChip, Loading, Screen, Scroll, T } from '@/components/ui';
import { useUid } from '@/lib/auth-context';
import { confirmAction } from '@/lib/confirm';
import { deleteReviewer, useAttempts, useFolders, useReviewer } from '@/lib/db';
import { plural } from '@/lib/format';
import { starsFor } from '@/lib/game';
import { mostMissed, scoreHistory, topicMastery, type TopicStat } from '@/lib/stats';
import { C, F, tintOf } from '@/theme';

const TAG: Record<TopicStat['level'], { bg: string; fg: string }> = {
  Strong: { bg: C.success50, fg: C.success700 },
  Good: { bg: C.primary100, fg: C.primary700 },
  Focus: { bg: C.danger50, fg: '#B91C1C' },
};

/** Statistics of one lesson (reviewer) + start button. */
export default function LessonStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const { reviewer, loading } = useReviewer(uid, id);
  const folders = useFolders(uid).data;
  const attempts = useAttempts(uid, id, 50).data;
  const [open, setOpen] = useState(false);

  if (loading) return <Loading />;
  if (!reviewer)
    return (
      <Screen>
        <Header title="Lesson" />
        <T style={{ padding: 20 }} color={C.muted}>This lesson was deleted.</T>
      </Screen>
    );

  const folder = folders.find((f) => f.id === reviewer.folderId);
  const color = folder ? tintOf(folder.tint).fg : C.navy;
  const history = scoreHistory(attempts);
  const topics = topicMastery(attempts);
  const missed = mostMissed(attempts, 2);
  const stars = reviewer.bestPercent === null ? 0 : starsFor(reviewer.bestPercent);
  const weakest = [...topics].reverse().find((t) => t.level !== 'Strong');

  const remove = () =>
    confirmAction(`Delete "${reviewer.title}"?`, 'Its questions will be deleted too. Your XP and past scores stay.', 'Delete', async () => {
      await deleteReviewer(uid, reviewer.id);
      router.back();
    });

  return (
    <Screen>
      <Header title={reviewer.title} kicker={`${folder?.name ?? 'No subject'} · lesson`} color={color}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Delete lesson" onPress={remove}
            style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trash" size={20} color="#FECACA" />
          </Pressable>
        }>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, flexWrap: 'wrap' }}>
          <HeaderChip><T w={900} size={13.5} color="#fff">{plural(attempts.length, 'try', 'tries')}</T></HeaderChip>
          <HeaderChip><T w={900} size={13.5} color="#fff">Best {reviewer.bestPercent ?? '–'}{reviewer.bestPercent !== null ? '%' : ''}</T></HeaderChip>
          <HeaderChip gold>
            {[0, 1, 2].map((i) => <Icon key={i} name="star" size={14} color={i < stars ? '#422006' : 'rgba(66,32,6,0.3)'} />)}
          </HeaderChip>
          <HeaderChip><T w={900} size={13.5} color="#fff">{reviewer.questionCount} Q · {reviewer.difficulty}</T></HeaderChip>
        </View>
      </Header>
      <Scroll>
        {history.length > 0 ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T w={900} size={15.5}>Score over time</T>
              {history.length > 1 && (
                <View style={{ backgroundColor: history[history.length - 1] >= history[0] ? C.success50 : C.danger50, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 }}>
                  <T w={900} size={11.5} color={history[history.length - 1] >= history[0] ? C.success700 : '#B91C1C'}>
                    {history[history.length - 1] - history[0] >= 0 ? '+' : ''}{history[history.length - 1] - history[0]}% since 1st try
                  </T>
                </View>
              )}
            </View>
            <ScoreChart scores={history.slice(-8)} />
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: 4 }}>
            <T w={900} size={16}>Not played yet</T>
            <T w={600} color={C.muted} style={{ textAlign: 'center' }}>Play this lesson to see your scores and topics here.</T>
          </Card>
        )}

        {topics.length > 0 && (
          <Card style={{ marginTop: 12, gap: 10 }}>
            <T w={900} size={15.5}>This lesson’s topics</T>
            {topics.map((t) => (
              <View key={t.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T w={800} size={13.5} style={{ flex: 1 }}>{t.name}</T>
                <View style={{ backgroundColor: TAG[t.level].bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2 }}>
                  <T w={900} size={11.5} color={TAG[t.level].fg}>{t.correct}/{t.total} {t.level}</T>
                </View>
              </View>
            ))}
          </Card>
        )}

        {missed.length > 0 && (
          <Card style={{ marginTop: 12, backgroundColor: C.amber50, borderBottomWidth: 0, gap: 6 }}>
            <T w={900} color="#78350F">{missed.length === 1 ? 'Most missed question' : 'Most missed questions'}</T>
            {missed.map((m) => (
              <T key={m.prompt} w={700} size={13.5} color="#422006">• “{m.prompt}” · missed {plural(m.times, 'time')}</T>
            ))}
          </Card>
        )}

        {reviewer.summary.length > 0 && (
          <Card style={{ marginTop: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkles" color={C.primary} />
              <T w={900} size={15.5}>AI summary</T>
            </View>
            {(open ? reviewer.summary : reviewer.summary.slice(0, 2)).map((line, i) => <T key={i} color={C.ink2}>• {line}</T>)}
            {reviewer.summary.length > 2 && <Btn small variant="soft" title={open ? 'Show less' : 'Read more'} onPress={() => setOpen(!open)} />}
          </Card>
        )}
      </Scroll>
      <Footer row>
        {weakest ? (
          <Btn title="Ask" icon="chat" variant="ghost" style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/chat', params: { ask: `Help me with ${weakest.name} from "${reviewer.title}"` } })} />
        ) : null}
        <Btn title={attempts.length ? 'Play again' : 'Play'} variant="success" icon="play" style={{ flex: 1.3 }} onPress={() => router.push({ pathname: '/briefing/[id]', params: { id: reviewer.id } })} />
      </Footer>
    </Screen>
  );
}

function ScoreChart({ scores }: { scores: number[] }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, 500) - 72;
  const h = 120;
  const pad = 18;
  const x = (i: number) => (scores.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (scores.length - 1));
  const y = (s: number) => h - 22 - ((s / 100) * (h - 42));
  const points = scores.map((s, i) => `${x(i)},${y(s)}`).join(' ');
  return (
    <Svg width={w} height={h} style={{ marginTop: 8 }} accessibilityLabel={`Scores: ${scores.join(', ')} percent`}>
      <Line x1={0} y1={h - 12} x2={w} y2={h - 12} stroke={C.line} strokeWidth={2} />
      <Line x1={0} y1={y(50)} x2={w} y2={y(50)} stroke="#EEF2F7" strokeWidth={1.5} strokeDasharray="4 4" />
      {scores.length > 1 && <Polyline points={points} fill="none" stroke={C.primary} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />}
      {scores.map((s, i) => {
        const lastPt = i === scores.length - 1;
        return (
          <Circle key={i} cx={x(i)} cy={y(s)} r={lastPt ? 7 : 6} fill={lastPt ? '#FBBF24' : '#fff'} stroke={lastPt ? '#B45309' : C.primary} strokeWidth={3} />
        );
      })}
      {scores.map((s, i) => (
        <SvgText key={`t${i}`} x={x(i)} y={y(s) - 12} fontSize={11} fontFamily={F.extrabold} fill={i === scores.length - 1 ? '#B45309' : C.muted} textAnchor="middle">{`${s}%`}</SvgText>
      ))}
    </Svg>
  );
}
