import type { Attempt } from './types';

export type TopicStat = { name: string; correct: number; total: number; pct: number; level: 'Strong' | 'Good' | 'Focus' };

const levelOf = (pct: number): TopicStat['level'] => (pct >= 85 ? 'Strong' : pct >= 65 ? 'Good' : 'Focus');

/** Adds up every attempt's per-topic results. */
export function topicMastery(attempts: Attempt[]): TopicStat[] {
  const sum = new Map<string, { correct: number; total: number }>();
  attempts.forEach((a) =>
    Object.entries(a.byTopic).forEach(([name, t]) => {
      const cur = sum.get(name) ?? { correct: 0, total: 0 };
      sum.set(name, { correct: cur.correct + t.correct, total: cur.total + t.total });
    }),
  );
  return [...sum]
    .map(([name, t]) => {
      const pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
      return { name, ...t, pct, level: levelOf(pct) };
    })
    .sort((a, b) => b.pct - a.pct);
}

export function strengthAndWeakness(topics: TopicStat[]) {
  const strength = topics.find((t) => t.level === 'Strong') ?? topics[0];
  const weakness = [...topics].reverse().find((t) => t.level !== 'Strong' && t !== strength);
  return { strength, weakness };
}

/** METANOIA's short advice for a subject (folder). */
export function recommendation(topics: TopicStat[], lessonsNotPlayed: number) {
  const focus = topics.filter((t) => t.level === 'Focus');
  if (!topics.length) return 'Play your first stage here and I’ll show what to focus on.';
  if (focus.length) {
    const names = focus.slice(0, 2).map((t) => t.name).join(' and ');
    return `Review ${names} first, then retake the stage. 10 quick questions will do!`;
  }
  if (lessonsNotPlayed) return `You’re doing great! ${lessonsNotPlayed} lesson${lessonsNotPlayed === 1 ? '' : 's'} here ${lessonsNotPlayed === 1 ? 'is' : 'are'} not played yet. Try ${lessonsNotPlayed === 1 ? 'it' : 'them'} next.`;
  return 'Excellent! Every topic here is strong. Try a Hard reviewer to level up faster.';
}

/** Oldest → newest scores of one lesson, for the chart. */
export const scoreHistory = (attempts: Attempt[]) =>
  [...attempts].sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)).map((a) => a.percent);

/** Questions answered wrong most often across attempts. */
export function mostMissed(attempts: Attempt[], max = 3) {
  const count = new Map<string, number>();
  attempts.forEach((a) => (a.missed ?? []).forEach((p) => count.set(p, (count.get(p) ?? 0) + 1)));
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, max).map(([prompt, times]) => ({ prompt, times }));
}
