import type { RobotSkinId } from '@/components/robot-skins';

import type { Attempt, DailyProgress, UserProfile } from './types';

/**
 * METAKNOWIA game rules in one place: XP, levels, stars, daily quests, journey goals and characters.
 * Change numbers here to rebalance the game; screens read everything from this file.
 */

// ------------------------------------------------------------------ XP
export const XP = {
  correct: 10,
  comboBonus: 2, // per answer while combo >= 3
  fastBonus: 5, // timer on and answered within the first third of the time
  verified: 50,
};

/** XP for one correct answer, given the combo after it and whether it was fast. */
export function answerXp(combo: number, fast: boolean) {
  return XP.correct + (combo >= 3 ? XP.comboBonus * Math.min(combo, 10) : 0) + (fast ? XP.fastBonus : 0);
}

// ------------------------------------------------------------------ levels
const TITLES = ['Newbie', 'Learner', 'Explorer', 'Achiever', 'Scholar', 'Expert', 'Master', 'Champion', 'Legend'];

/** XP needed to reach `level` (level 1 = 0 XP). Each level asks for a bit more than the last. */
export const xpForLevel = (level: number) => (level <= 1 ? 0 : Math.round(50 * (level - 1) * (level + 2)));

export function levelInfo(xp = 0) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const from = xpForLevel(level);
  const to = xpForLevel(level + 1);
  return { level, title: TITLES[Math.min(level - 1, TITLES.length - 1)], into: xp - from, need: to - from, toNext: to - xp, xp };
}

// ------------------------------------------------------------------ stars
export const starsFor = (percent: number) => (percent >= 90 ? 3 : percent >= 70 ? 2 : percent >= 50 ? 1 : 0);

// ------------------------------------------------------------------ dates
export function localDay(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** ISO-ish week key like "2026-W45" (weeks start Monday), used for weekly goals. */
export function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The streak still counts today if the student studied today or yesterday. */
export function liveStreak(p: UserProfile) {
  const last = p.stats.lastStudyDay;
  if (!last) return 0;
  const yesterday = localDay(new Date(Date.now() - 86_400_000));
  return last === localDay() || last === yesterday ? p.stats.streak : 0;
}

// ------------------------------------------------------------------ daily quests
export const todayProgress = (p: UserProfile): DailyProgress =>
  p.daily?.day === localDay() ? p.daily : { day: localDay(), answered: 0, bestPercent: 0, asked: 0, claimed: [] };

export type Quest = { id: string; title: string; xp: number; icon: 'check' | 'target' | 'chat'; value: number; goal: number };

export function dailyQuests(p: UserProfile): Quest[] {
  const d = todayProgress(p);
  return [
    { id: 'answer10', title: 'Answer 10 questions', xp: 20, icon: 'check', value: Math.min(d.answered, 10), goal: 10 },
    { id: 'score80', title: 'Get 80% on a reviewer', xp: 30, icon: 'target', value: Math.min(d.bestPercent, 80), goal: 80 },
    { id: 'ask1', title: 'Ask METANOIA 1 question', xp: 10, icon: 'chat', value: Math.min(d.asked, 1), goal: 1 },
  ];
}
export const CHEST_XP = 50;

// ------------------------------------------------------------------ journey goals
export type Goal = { key: string; title: string; detail: string; xp: number; value: number; goal: number; icon: 'flame' | 'target' | 'star' | 'gift' };

export function journeyGoals(p: UserProfile, attempts: Attempt[]): Goal[] {
  const streak = liveStreak(p);
  const wk = weekKey();
  const stagesThisWeek = attempts.filter((a) => a.createdAt && weekKey(a.createdAt.toDate()) === wk).length;
  const threeStars = attempts.some((a) => (a.stars ?? starsFor(a.percent)) === 3) || p.stats.bestPercent >= 90;
  const goals: Goal[] = [
    { key: 'streak-3', title: 'Study 3 days in a row', detail: 'Streak goal', xp: 30, value: Math.min(streak, 3), goal: 3, icon: 'flame' },
    { key: 'streak-7', title: '7-day streak', detail: 'Also unlocks the Beanie outfit', xp: 80, value: Math.min(streak, 7), goal: 7, icon: 'gift' },
    { key: 'streak-14', title: '14-day streak', detail: 'Streak goal', xp: 150, value: Math.min(streak, 14), goal: 14, icon: 'flame' },
    { key: `week-${wk}`, title: 'Finish 3 stages this week', detail: 'Resets every Monday', xp: 80, value: Math.min(stagesThisWeek, 3), goal: 3, icon: 'target' },
    { key: 'three-stars', title: 'Get 3 stars on any stage', detail: 'Score 90% or higher', xp: 40, value: threeStars ? 1 : 0, goal: 1, icon: 'star' },
  ];
  return goals;
}

/** Milestones shown on the streak road. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

// ------------------------------------------------------------------ level rewards
/** Robot color skins. The pictures are made by scripts/make-robot-skins.mjs. */
export const SKINS: { id: RobotSkinId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'mint', label: 'Mint' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'grape', label: 'Grape' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'lime', label: 'Lime' },
  { id: 'rose', label: 'Rose' },
  { id: 'sky', label: 'Sky' },
  { id: 'coral', label: 'Coral' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'gold', label: 'Gold' },
  { id: 'galaxy', label: 'Galaxy' },
];

export type LevelReward =
  | { level: number; kind: 'skin'; id: RobotSkinId; label: string }
  | { level: number; kind: 'avatar'; id: string; label: string };

/** Every level from 2 up gives one prize: a robot skin, or a profile picture character. */
export const LEVEL_REWARDS: LevelReward[] = [
  ...SKINS.slice(1, 9).map((s, i) => ({ level: i + 2, kind: 'skin' as const, id: s.id, label: `${s.label} skin` })), // LV 2–9
  { level: 10, kind: 'avatar', id: 'king', label: 'King' },
  { level: 11, kind: 'skin', id: 'midnight', label: 'Midnight skin' },
  { level: 12, kind: 'skin', id: 'gold', label: 'Gold skin' },
  { level: 13, kind: 'skin', id: 'galaxy', label: 'Galaxy skin' },
  { level: 14, kind: 'avatar', id: 'star', label: 'Star' },
];

/** Level that unlocks a skin (classic = 1). */
export const skinLevel = (id: string) => LEVEL_REWARDS.find((r) => r.kind === 'skin' && r.id === id)?.level ?? 1;

/** The next prize the student has not reached yet, or null when every reward is unlocked. */
export const nextReward = (xp = 0) => LEVEL_REWARDS.find((r) => r.level > levelInfo(xp).level) ?? null;

// ------------------------------------------------------------------ characters (profile picture)
export type Character = { id: string; label: string; bg: string; fg: string; level: number };
export const CHARACTERS: Character[] = [
  { id: 'metanoia', label: 'METANOIA', bg: '#FEF3C7', fg: '#F59E0B', level: 1 },
  { id: 'sunny', label: 'Sunny', bg: '#DCFCE7', fg: '#16A34A', level: 1 },
  { id: 'scholar', label: 'Scholar', bg: '#EDE9FE', fg: '#7C3AED', level: 1 },
  { id: 'kit', label: 'Kit', bg: '#CCFBF1', fg: '#0D9488', level: 1 },
  { id: 'mochi', label: 'Mochi', bg: '#FFE4E6', fg: '#DB2777', level: 1 },
  { id: 'bolt', label: 'Bolt', bg: '#DBEAFE', fg: '#2563EB', level: 1 },
  { id: 'king', label: 'King', bg: '#FEF9C3', fg: '#CA8A04', level: 10 },
  { id: 'star', label: 'Star', bg: '#E0E7FF', fg: '#4F46E5', level: 14 }, // keep in step with LEVEL_REWARDS
];
