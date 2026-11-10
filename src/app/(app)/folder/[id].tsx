import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ReviewerRow } from '@/components/ReviewerRow';
import { Robot } from '@/components/Robot';
import { Btn, Card, Empty, Header, Screen, Scroll, Section, T } from '@/components/ui';
import { useUid } from '@/lib/auth-context';
import { useAttempts, useFolders, useReviewers } from '@/lib/db';
import { plural } from '@/lib/format';
import { recommendation, strengthAndWeakness, topicMastery, type TopicStat } from '@/lib/stats';
import { C, tintOf } from '@/theme';

const LEVEL_COLOR: Record<TopicStat['level'], string> = { Strong: '#22C55E', Good: C.primary, Focus: C.danger };

/** A subject: overall statistics plus its lessons. */
export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const folder = useFolders(uid).data.find((f) => f.id === id);
  const { data: reviewers, loading } = useReviewers(uid, id);
  const allAttempts = useAttempts(uid, undefined, 300).data;

  const ids = new Set(reviewers.map((r) => r.id));
  const attempts = allAttempts.filter((a) => ids.has(a.reviewerId));
  const topics = topicMastery(attempts);
  const { strength, weakness } = strengthAndWeakness(topics);
  const scored = reviewers.filter((r) => r.bestPercent !== null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.bestPercent ?? 0), 0) / scored.length) : null;
  const totalQ = reviewers.reduce((a, r) => a + r.questionCount, 0);
  const color = folder ? tintOf(folder.tint).fg : C.navy;

  return (
    <Screen>
      <Header title={folder?.name ?? 'Subject'} sub={`${plural(reviewers.length, 'lesson')} · ${plural(totalQ, 'question')}`} color={color}
        right={<View style={{ alignItems: 'center' }}><T w={900} size={26} color="#fff">{avg === null ? '–' : `${avg}%`}</T><T w={900} size={11} color="rgba(255,255,255,0.85)">AVERAGE</T></View>} />
      <Scroll>
        {topics.length > 0 ? (
          <>
            <Card style={{ gap: 12 }}>
              <T w={900} size={15.5}>Topic mastery</T>
              {topics.map((t) => (
                <View key={t.name} accessibilityLabel={`${t.name}: ${t.pct} percent, ${t.level}`}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T w={800} size={13.5}>{t.name}</T>
                    <T w={800} size={13.5} color={LEVEL_COLOR[t.level]}>{t.pct}%{t.level !== 'Good' ? ` · ${t.level}` : ''}</T>
                  </View>
                  <View style={{ height: 12, borderRadius: 99, backgroundColor: '#EEF2F7', overflow: 'hidden', marginTop: 4 }}>
                    <View style={{ width: `${t.pct}%`, height: '100%', borderRadius: 99, backgroundColor: LEVEL_COLOR[t.level] }} />
                  </View>
                </View>
              ))}
            </Card>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              {strength && <Tag kind="STRENGTH" t={strength} bg={C.success50} fg={C.success700} note={`${strength.correct} of ${strength.total} correct`} />}
              {weakness && <Tag kind="NEEDS FOCUS" t={weakness} bg={C.danger50} fg="#B91C1C" note={`${weakness.correct} of ${weakness.total} correct`} />}
            </View>
          </>
        ) : (
          <Card style={{ alignItems: 'center', gap: 4 }}>
            <T w={900} size={16}>No stats yet</T>
            <T w={600} color={C.muted} style={{ textAlign: 'center' }}>Play a stage in this subject to see your strengths and weaknesses.</T>
          </Card>
        )}

        <Card style={{ marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#EEF4FF', borderBottomWidth: 0 }}>
          <Robot size={48} still mood={weakness ? 'happy' : 'proud'} />
          <T w={700} size={13.5} color={C.ink2} style={{ flex: 1 }}>
            <T w={900} size={13.5} color={C.navy}>METANOIA recommends: </T>
            {recommendation(topics, reviewers.filter((r) => r.bestPercent === null).length)}
          </T>
        </Card>

        <Section title="Lessons">
          {!loading && reviewers.length === 0 ? (
            <Empty icon="sparkles" title="This subject is empty" text="Make a reviewer and save it here." />
          ) : (
            <View style={{ gap: 10 }}>
              {reviewers.map((r) => <ReviewerRow key={r.id} uid={uid} reviewer={r} folder={folder} />)}
            </View>
          )}
        </Section>
        <Btn title="Add a lesson" icon="plus" variant="soft" style={{ marginTop: 18 }} onPress={() => router.push({ pathname: '/add-reviewer', params: { folderId: id } })} />
      </Scroll>
    </Screen>
  );
}

function Tag({ kind, t, bg, fg, note }: { kind: string; t: TopicStat; bg: string; fg: string; note: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 18, padding: 12, gap: 4 }}>
      <View style={{ alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 }}>
        <T w={900} size={11} color={fg}>{kind}</T>
      </View>
      <T w={900} size={15}>{t.name}</T>
      <T w={600} size={12.5} color={fg}>{note}</T>
    </View>
  );
}
