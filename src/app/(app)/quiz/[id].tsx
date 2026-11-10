import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AnswerArea, QuestionPrompt } from '@/components/QuestionAnswer';
import { correctAnswerText, pointsOf, typeLabel, typeOf } from '@/lib/question-types';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Btn, HeaderDecor, Loading, Screen, Scroll, T } from '@/components/ui';
import { useUid } from '@/lib/auth-context';
import { confirmAction, notify } from '@/lib/confirm';
import { getQuestions, saveAttempt, saveProgress, useReviewer } from '@/lib/db';
import { answerXp } from '@/lib/game';
import { useLang } from '@/lib/lang';
import { column, CONTENT_MAX } from '@/lib/responsive';
import type { Attempt, Question } from '@/lib/types';
import { C } from '@/theme';

const PRAISE = {
  en: ['Great! Correct!', 'Awesome!', 'Nice one!', 'Perfect!'],
  tl: ['Galing! Correct!', 'Ayos! Tama!', 'Nice one!', 'Perfect!'],
};

function shuffled<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * One question at a time. Params from the briefing screen:
 *   timer = seconds per question (0 = off), shuffle = '1' to shuffle, restart = '1' to ignore saved progress.
 */
export default function Quiz() {
  const params = useLocalSearchParams<{ id: string; timer?: string; shuffle?: string; restart?: string }>();
  const id = params.id;
  const timerSec = Number(params.timer ?? 0) || 0;
  const shuffle = params.shuffle === '1';
  const uid = useUid();
  const lang = useLang();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { reviewer } = useReviewer(uid, id);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // -1 = time ran out
  const [correct, setCorrect] = useState(0);
  const [byTopic, setByTopic] = useState<Attempt['byTopic']>({});
  const [byType, setByType] = useState<Attempt['byTopic']>({});
  // Points of the current question once answered (a matching set can be partly right).
  const [result, setResult] = useState<{ points: number; max: number } | null>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [gain, setGain] = useState<number | null>(null);
  const [left, setLeft] = useState(timerSec);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    getQuestions(uid, id).then((qs) => setQuestions(shuffle ? shuffled(qs) : qs)).catch(() => setQuestions([]));
    // Load once per stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, id]);

  // Resume an unfinished attempt once (not for shuffled or restarted stages: the order would differ).
  if (!ready && reviewer && questions) {
    setReady(true);
    if (!shuffle && params.restart !== '1' && reviewer.answered > 0 && reviewer.answered < questions.length) {
      setIdx(reviewer.answered);
      setCorrect(reviewer.partialCorrect ?? 0);
      setByTopic(reviewer.partialByTopic ?? {});
      setByType(reviewer.partialByType ?? {});
    }
  }

  const q = questions?.[idx];
  const answered = result !== null;

  // Per-question countdown.
  useEffect(() => {
    if (!timerSec || !q || answered) return;
    startedAt.current = Date.now();
    const t = setInterval(() => {
      const remaining = Math.max(0, timerSec - Math.floor((Date.now() - startedAt.current) / 1000));
      setLeft(remaining);
      if (remaining === 0) {
        clearInterval(t);
        record(0, -1);
      }
    }, 250);
    return () => clearInterval(t);
    // Restart only when the question changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, ready, timerSec, answered]);

  if (!questions || !reviewer || !ready) return <Loading />;
  if (!q)
    return (
      <Screen>
        <T style={{ padding: 20, paddingTop: 60 }}>This reviewer has no questions.</T>
        <Btn title="Go back" onPress={() => router.back()} style={{ margin: 20 }} />
      </Screen>
    );

  const isRight = !!result && result.points === result.max;
  // Every matching pair is an item, so the score is out of points, not questions.
  const totalPoints = questions.reduce((n, x) => n + pointsOf(x), 0);
  const last = idx === questions.length - 1;

  function record(points: number, i?: number) {
    if (!q || result) return;
    const max = pointsOf(q);
    const ok = points >= max;
    setPicked(i ?? null);
    setResult({ points, max });
    const nextCombo = ok ? combo + 1 : 0;
    const fast = !!timerSec && Date.now() - startedAt.current <= (timerSec * 1000) / 3;
    // A partly right matching set still earns a little XP per pair.
    const earned = ok ? answerXp(nextCombo, fast) : points * 5;
    const nextCorrect = correct + points;
    const cur = byTopic[q.topic] ?? { correct: 0, total: 0 };
    const nextByTopic = { ...byTopic, [q.topic]: { correct: cur.correct + points, total: cur.total + max } };
    const kind = typeOf(q);
    const curT = byType[kind] ?? { correct: 0, total: 0 };
    const nextByType = { ...byType, [kind]: { correct: curT.correct + points, total: curT.total + max } };
    setByType(nextByType);
    setCombo(nextCombo);
    setBestCombo((b) => Math.max(b, nextCombo));
    setXp((x) => x + earned);
    setGain(earned || null);
    setCorrect(nextCorrect);
    setByTopic(nextByTopic);
    if (!ok) setMissed((m) => [...m, q.prompt]);
    if (!shuffle && idx + 1 < questions!.length) saveProgress(uid, id, idx + 1, nextCorrect, nextByTopic, nextByType).catch(() => {});
  }

  const next = async () => {
    setGain(null);
    if (!last) {
      setLeft(timerSec);
      setIdx(idx + 1);
      setPicked(null);
      setResult(null);
      return;
    }
    setSaving(true);
    try {
      const res = await saveAttempt(uid, reviewer, { correct, total: totalPoints, byTopic, byType, missed, xpEarned: xp, bestCombo });
      router.replace({ pathname: '/results/[id]', params: { id: res.id, badges: res.newBadges.join('|') } });
    } catch {
      setSaving(false);
      notify('Could not save your score', 'Check your internet connection and try again.');
    }
  };

  const quit = () => confirmAction('Stop this stage?', shuffle ? 'Shuffled stages are not saved midway.' : 'Your progress so far is saved.', 'Stop', () => router.back());
  const progress = ((idx + (answered ? 1 : 0)) / questions.length) * 100;
  const ringR = 23;
  const ringC = 2 * Math.PI * ringR;
  const urgent = timerSec > 0 && left <= Math.max(3, timerSec / 5);

  return (
    <Screen>
      <View style={{ backgroundColor: C.navy, paddingTop: insets.top + 8, paddingBottom: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' }}>
        <HeaderDecor />
        <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop this stage" onPress={quit}
            style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="x" color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ height: 14, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
              <View style={{ width: `${progress}%`, height: '100%', borderRadius: 99, backgroundColor: '#22C55E' }} />
            </View>
            <T w={800} size={12} color="#BFDBFE" style={{ marginTop: 6 }}>Question {idx + 1} of {questions.length}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T w={900} size={13} color="#FBBF24">{xp} XP</T>
            {combo >= 2 && (
              <Animated.View entering={ZoomIn} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7C3AED', borderRadius: 99, paddingHorizontal: 9, height: 26, borderBottomWidth: 3, borderBottomColor: '#5B21B6', marginTop: 2 }}>
                <Icon name="zap" size={13} color="#fff" />
                <T w={900} size={12.5} color="#fff">Combo ×{combo}</T>
              </Animated.View>
            )}
          </View>
        </View>
      </View>

      <Scroll style={{ paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {timerSec > 0 && (
            <View style={{ width: 56, height: 56 }} accessibilityLabel={`${left} seconds left`} accessibilityLiveRegion={urgent ? 'polite' : 'none'}>
              <Svg width={56} height={56}>
                <Circle cx={28} cy={28} r={ringR} fill="#fff" stroke={C.line} strokeWidth={6} />
                <Circle cx={28} cy={28} r={ringR} fill="none" stroke={urgent ? C.danger : C.warning} strokeWidth={6} strokeLinecap="round"
                  strokeDasharray={`${(ringC * left) / timerSec} ${ringC}`} transform="rotate(-90 28 28)" />
              </Svg>
              <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
                <T w={900} size={17} color={urgent ? C.danger : '#B45309'}>{left}</T>
              </View>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <T w={900} size={12.5} color={C.primary700} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{typeLabel(q.type)} · {q.topic}</T>
            {timerSec > 0 && <T w={800} size={12.5} color="#B45309">Answer within {Math.max(1, Math.round(timerSec / 3))}s for bonus XP</T>}
          </View>
        </View>
        <QuestionPrompt q={q} />
        <AnswerArea key={q.id} q={q} answered={answered} picked={picked} onAnswer={record} />
      </Scroll>

      {gain && (
        <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} pointerEvents="none"
          style={{ position: 'absolute', right: Math.max(26, (width - CONTENT_MAX) / 2 + 26), top: insets.top + 170, backgroundColor: '#FBBF24', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 4, borderBottomColor: '#B45309', transform: [{ rotate: '6deg' }] }}>
          <T w={900} size={18} color="#422006">+{gain} XP</T>
        </Animated.View>
      )}

      {answered && (
        <Animated.View entering={FadeInDown.duration(220)} style={{ padding: 20, paddingBottom: 20 + insets.bottom, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: isRight ? C.success50 : C.danger50 }}>
          <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Robot size={48} mood={isRight ? 'excited' : 'worried'} intro={isRight ? 'cheer' : 'no'} />
            <View style={{ flex: 1 }}>
              <T w={900} size={19} color={isRight ? C.success700 : '#B91C1C'}>
                {isRight ? PRAISE[lang][idx % PRAISE[lang].length] : picked === -1 ? 'Time’s up!' : result && result.max > 1 && result.points > 0 ? `${result.points} of ${result.max} right` : 'Not quite'}
              </T>
              {!isRight && typeOf(q) !== 'mcq' && typeOf(q) !== 'tf' && (
                <T w={800} size={13.5} color="#7F1D1D">Answer: {correctAnswerText(q)}</T>
              )}
              {q.explanation ? <T w={600} size={13.5} color={isRight ? '#14532D' : '#7F1D1D'}>{q.explanation}</T> : null}
            </View>
          </View>
          <Btn title={last ? 'See my score' : 'Continue'} variant={isRight ? 'success' : 'primary'} onPress={next} loading={saving} style={[column, { marginTop: 14 }]} />
        </Animated.View>
      )}
    </Screen>
  );
}
