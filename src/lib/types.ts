import type { Timestamp } from 'firebase/firestore';

export type GradeLevel = 'Elementary' | 'High School' | 'Senior High' | 'College';

export type OutfitSlot = 'head' | 'face' | 'neck';
/** skin: robot color unlocked by levelling up (see LEVEL_REWARDS). Missing = classic. */
export type Outfit = { head: string; face: string; neck: string; skin?: string };
export const DEFAULT_OUTFIT: Outfit = { head: 'none', face: 'none', neck: 'none' };

/** users/{uid} */
export type UserProfile = {
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  gradeLevel: GradeLevel;
  outfit: Outfit;
  remindersOn: boolean;
  reminderLeadMin: number;
  dailyReminderOn: boolean;
  /** Exam reminders. Missing means on. */
  examRemindersOn?: boolean;
  /** Days before an exam to remind (e.g. [7, 3, 1]). Missing means EXAM_REMINDER_DEFAULTS.days. */
  examReminderDays?: number[];
  /** Time of day for those reminders, in hours (19 = 7:00 PM). */
  examReminderTime?: number;
  /** Also remind 1 hour before the exam starts. Missing means on. */
  examReminderHourBefore?: boolean;
  /** Time of the daily study reminder, in hours (19.5 = 7:30 PM). Missing means 7:00 PM. */
  dailyReminderTime?: number;
  /** Running totals so Home/Profile never have to scan every attempt. */
  stats: {
    attempts: number;
    totalPercent: number;
    bestPercent: number;
    perfectScores: number;
    streak: number;
    lastStudyDay: string | null; // YYYY-MM-DD in the device's local time
    /** Total experience points. Level is computed from it (see game.ts). Older accounts may lack it. */
    xp?: number;
  };
  /** Today's quest counters; reset when `day` is not today. */
  daily?: DailyProgress;
  /** Keys of claimed one-time and weekly rewards (e.g. "streak-7", "week-2026-45", "verified"). */
  claimed?: string[];
  /** Badge ids, e.g. "first-step" or "topic:Sports safety". */
  badges?: string[];
  avatar?: Avatar;
  /** Language METANOIA talks in. Missing means English. */
  language?: Lang;
  createdAt?: Timestamp;
};

export type Lang = 'en' | 'tl';

export type DailyProgress = { day: string; answered: number; bestPercent: number; asked: number; claimed: string[] };

/** A built-in character, or a small JPEG data URI kept on the profile document (no Cloud Storage needed). */
export type Avatar = { kind: 'character'; id: string } | { kind: 'photo'; dataUri: string };

/** users/{uid}/folders/{id} */
export type Folder = { id: string; name: string; icon: string; tint: string; createdAt?: Timestamp };

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type SourceType = 'text' | 'file' | 'photo';

/** users/{uid}/reviewers/{id} */
export type Reviewer = {
  id: string;
  title: string;
  folderId: string | null;
  sourceType: SourceType;
  sourcePath: string | null; // Cloud Storage path of the uploaded lesson, if any
  summary: string[];
  questionCount: number;
  difficulty: Difficulty;
  answered: number; // questions answered in the latest attempt (for the progress bar)
  partialCorrect?: number; // score so far of an unfinished attempt, so "Continue" can resume it
  partialByTopic?: Record<string, { correct: number; total: number }>;
  partialByType?: Record<string, { correct: number; total: number }>;
  /** Items per question type, e.g. { fill: 20, mcq: 15, id: 15 }. Missing on older reviewers (all multiple choice). */
  types?: Partial<Record<QuestionType, number>>;
  bestPercent: number | null;
  lastPercent: number | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/**
 * mcq multiple choice · fill fill in the blanks · tf true or false · id identification · match matching type
 * enum enumeration · mtf modified true or false · seq sequencing.
 */
export type QuestionType = 'mcq' | 'fill' | 'tf' | 'id' | 'match' | 'enum' | 'mtf' | 'seq';

/**
 * users/{uid}/reviewers/{id}/questions/{qid}
 * Which fields are used depends on `type` (missing = 'mcq', for reviewers made before types existed):
 *  mcq, tf: choices + answerIndex (tf choices are ["True", "False"])
 *  fill: prompt has "____" where the word goes; answers = accepted words
 *  id: answers = accepted terms · enum: answers = every item to list
 *  mtf: prompt marks the key word as **word**; answerIndex 0 = true, 1 = false; answers[0] = the right word when false
 *  match: pairs (left ↔ right) · seq: items in the correct order
 */
export type Question = {
  id: string;
  order: number;
  type?: QuestionType;
  prompt: string;
  choices: string[];
  answerIndex: number;
  answers?: string[];
  pairs?: { left: string; right: string }[];
  items?: string[];
  explanation: string;
  topic: string;
};

/** users/{uid}/attempts/{id} */
export type Attempt = {
  id: string;
  reviewerId: string;
  reviewerTitle: string;
  correct: number;
  total: number;
  percent: number;
  byTopic: Record<string, { correct: number; total: number }>;
  /** Score per question type (keys are QuestionType). */
  byType?: Record<string, { correct: number; total: number }>;
  /** Prompts of the questions answered wrong (or timed out), for "most missed" stats. */
  missed?: string[];
  xpEarned?: number;
  bestCombo?: number;
  stars?: number;
  createdAt?: Timestamp;
};

/** users/{uid}/classes/{id}  day: 1 = Monday … 6 = Saturday, 7 = Sunday. start/end in hours (13.5 = 1:30 PM). */
export type ClassItem = {
  id: string;
  subject: string;
  code: string;
  color: string;
  day: number;
  start: number;
  end: number;
  room: string;
  teacher: string;
};

/** users/{uid}/exams/{id}  date: YYYY-MM-DD (local). start/end in hours like ClassItem. */
export type ExamItem = {
  id: string;
  subject: string;
  title: string;
  date: string;
  start: number;
  end: number;
  room: string;
  notes: string;
  color: string;
  /** The Subject (folder) whose reviewers are suggested for this exam. Older exams match by name. */
  folderId?: string | null;
};

/** users/{uid}/messages/{id} */
export type ChatMessage = { id: string; role: 'user' | 'bot'; text: string; createdAt?: Timestamp };
