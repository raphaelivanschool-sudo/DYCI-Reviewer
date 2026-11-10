import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Query,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from './firebase';
import { CHEST_XP, dailyQuests, localDay, starsFor, todayProgress } from './game';
import type { Attempt, Avatar, ChatMessage, ClassItem, ExamItem, Folder, Question, Reviewer, UserProfile } from './types';

// ------------------------------------------------------------------ paths
const userDoc = (uid: string) => doc(db, 'users', uid);
const col = (uid: string, name: string) => collection(db, 'users', uid, name);

// ------------------------------------------------------------------ live query hook
/** Subscribes to a Firestore query. `key` must change whenever the query changes. */
export function useLive<T>(makeQuery: () => Query<DocumentData> | null, key: string) {
  // Results are stored with the key they belong to, so a new key reads as "loading" without
  // resetting state inside the effect.
  const [state, setState] = useState<{ key: string | null; data: T[]; error: string | null }>({ key: null, data: [], error: null });
  useEffect(() => {
    const q = makeQuery();
    if (!q) return;
    return onSnapshot(
      q,
      (snap) => setState({ key, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), error: null }),
      (e) => setState({ key, data: [], error: e.message }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key;
  return { data: current ? state.data : [], loading: !current, error: current ? state.error : null };
}

const millis = (t?: { toMillis: () => number } | null) => (t ? t.toMillis() : Date.now());

/**
 * Oldest first. Sorted on the phone too: a subject that was just created has no server time yet,
 * and treating it as "now" keeps it at the end instead of jumping around while it saves.
 */
export function useFolders(uid: string) {
  const r = useLive<Folder>(() => query(col(uid, 'folders'), orderBy('createdAt', 'asc')), `folders/${uid}`);
  return { ...r, data: [...r.data].sort((a, b) => millis(a.createdAt) - millis(b.createdAt)) };
}

/** Filtered lists are sorted on the device so no composite Firestore index is needed. */
export function useReviewers(uid: string, folderId?: string) {
  const r = useLive<Reviewer>(
    () => (folderId ? query(col(uid, 'reviewers'), where('folderId', '==', folderId)) : query(col(uid, 'reviewers'), orderBy('updatedAt', 'desc'))),
    `reviewers/${uid}/${folderId ?? '*'}`,
  );
  const data = folderId ? [...r.data].sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt)) : r.data;
  return { ...r, data };
}

export function useReviewer(uid: string, id: string) {
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      onSnapshot(doc(col(uid, 'reviewers'), id), (snap) => {
        setReviewer(snap.exists() ? ({ id: snap.id, ...snap.data() } as Reviewer) : null);
        setLoading(false);
      }),
    [uid, id],
  );
  return { reviewer, loading };
}

export function useAttempts(uid: string, reviewerId?: string, max = 20) {
  const r = useLive<Attempt>(
    () => (reviewerId ? query(col(uid, 'attempts'), where('reviewerId', '==', reviewerId)) : query(col(uid, 'attempts'), orderBy('createdAt', 'desc'), limit(max))),
    `attempts/${uid}/${reviewerId ?? '*'}/${max}`,
  );
  const data = reviewerId ? [...r.data].sort((a, b) => millis(b.createdAt) - millis(a.createdAt)).slice(0, max) : r.data;
  return { ...r, data };
}

export function useClasses(uid: string) {
  const r = useLive<ClassItem>(() => query(col(uid, 'classes')), `classes/${uid}`);
  return { ...r, data: [...r.data].sort((a, b) => a.day - b.day || a.start - b.start) };
}

export const useMessages = (uid: string) =>
  useLive<ChatMessage>(() => query(col(uid, 'messages'), orderBy('createdAt', 'asc'), limit(200)), `messages/${uid}`);

// ------------------------------------------------------------------ profile
export const updateProfileFields = (uid: string, fields: Partial<UserProfile>) => updateDoc(userDoc(uid), fields as DocumentData);

// ------------------------------------------------------------------ folders
export const createFolder = (uid: string, name: string, icon: string, tint: string) =>
  addDoc(col(uid, 'folders'), { name: name.trim(), icon, tint, createdAt: serverTimestamp() });

export const updateFolder = (uid: string, id: string, f: Partial<Pick<Folder, 'name' | 'icon' | 'tint'>>) =>
  updateDoc(doc(col(uid, 'folders'), id), { ...f, ...(f.name ? { name: f.name.trim() } : {}) });

export async function deleteFolder(uid: string, folderId: string) {
  // Reviewers inside are kept and moved to "No folder".
  const batch = writeBatch(db);
  const inside = await getDocs(query(col(uid, 'reviewers'), where('folderId', '==', folderId)));
  inside.forEach((d) => batch.update(d.ref, { folderId: null }));
  batch.delete(doc(col(uid, 'folders'), folderId));
  await batch.commit();
}

// ------------------------------------------------------------------ reviewers
export type NewReviewer = Omit<Reviewer, 'id' | 'createdAt' | 'updatedAt' | 'answered' | 'bestPercent' | 'lastPercent' | 'questionCount'>;

export async function saveReviewer(uid: string, data: NewReviewer, questions: Omit<Question, 'id'>[]) {
  const ref = doc(col(uid, 'reviewers'));
  const batch = writeBatch(db);
  // Items per type, so the results screen can show the score for each part of a Mix.
  const types: Record<string, number> = {};
  questions.forEach((q) => (types[q.type ?? 'mcq'] = (types[q.type ?? 'mcq'] ?? 0) + 1));
  batch.set(ref, {
    ...data,
    types,
    questionCount: questions.length,
    answered: 0,
    bestPercent: null,
    lastPercent: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  // Firestore rejects undefined values, so leave out the fields a question type doesn't use.
  questions.forEach((q) => batch.set(doc(collection(ref, 'questions')), Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined))));
  await batch.commit();
  return ref.id;
}

export async function getQuestions(uid: string, reviewerId: string) {
  const snap = await getDocs(query(collection(db, 'users', uid, 'reviewers', reviewerId, 'questions'), orderBy('order')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
}

export async function deleteReviewer(uid: string, reviewerId: string) {
  const ref = doc(col(uid, 'reviewers'), reviewerId);
  const qs = await getDocs(collection(ref, 'questions'));
  const batch = writeBatch(db);
  qs.forEach((d) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}

export const renameReviewer = (uid: string, reviewerId: string, title: string) =>
  updateDoc(doc(col(uid, 'reviewers'), reviewerId), { title: title.trim(), updatedAt: serverTimestamp() });

export const moveReviewer = (uid: string, reviewerId: string, folderId: string | null) =>
  updateDoc(doc(col(uid, 'reviewers'), reviewerId), { folderId, updatedAt: serverTimestamp() });

/** Records progress mid-quiz so Home can show "12 of 20". */
export const saveProgress = (uid: string, reviewerId: string, answered: number, partialCorrect: number, partialByTopic: Attempt['byTopic'], partialByType: Attempt['byTopic'] = {}) =>
  updateDoc(doc(col(uid, 'reviewers'), reviewerId), { answered, partialCorrect, partialByTopic, partialByType, updatedAt: serverTimestamp() });

// ------------------------------------------------------------------ attempts + stats
export { localDay };

export type AttemptResult = {
  correct: number;
  total: number;
  byTopic: Attempt['byTopic'];
  byType?: Attempt['byTopic'];
  missed: string[];
  xpEarned: number;
  bestCombo: number;
};

/**
 * Saves an attempt and, in one transaction, updates the reviewer, the streak, XP, today's quest
 * counters and topic badges. Returns the new attempt id and any badge earned for the results screen.
 */
export async function saveAttempt(uid: string, reviewer: Reviewer, r: AttemptResult) {
  const percent = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  const stars = starsFor(percent);
  const attemptRef = doc(col(uid, 'attempts'));
  const reviewerRef = doc(col(uid, 'reviewers'), reviewer.id);
  let newBadges: string[] = [];
  await runTransaction(db, async (tx) => {
    const profile = (await tx.get(userDoc(uid))).data() as UserProfile | undefined;
    const stats = profile?.stats;
    const today = localDay();
    const yesterday = localDay(new Date(Date.now() - 86_400_000));
    let streak = stats?.streak ?? 0;
    if (stats?.lastStudyDay !== today) streak = stats?.lastStudyDay === yesterday ? streak + 1 : 1;

    const daily = profile ? todayProgress(profile) : { day: today, answered: 0, bestPercent: 0, asked: 0, claimed: [] };
    // A topic with 3+ questions all correct earns a "topic master" badge once.
    const owned = new Set(profile?.badges ?? []);
    newBadges = Object.entries(r.byTopic)
      .filter(([, t]) => t.total >= 3 && t.correct === t.total)
      .map(([name]) => `topic:${name}`)
      .filter((b) => !owned.has(b));

    tx.set(attemptRef, {
      reviewerId: reviewer.id, reviewerTitle: reviewer.title, correct: r.correct, total: r.total, percent,
      byTopic: r.byTopic, byType: r.byType ?? {}, missed: r.missed.slice(0, 50), xpEarned: r.xpEarned, bestCombo: r.bestCombo, stars,
      createdAt: serverTimestamp(),
    });
    tx.update(reviewerRef, {
      // Questions, not points: a matching set is one question worth several points.
      answered: reviewer.questionCount,
      partialCorrect: 0,
      partialByTopic: {},
      partialByType: {},
      lastPercent: percent,
      bestPercent: Math.max(percent, reviewer.bestPercent ?? 0),
      updatedAt: serverTimestamp(),
    });
    tx.update(userDoc(uid), {
      'stats.attempts': increment(1),
      'stats.totalPercent': increment(percent),
      'stats.bestPercent': Math.max(percent, stats?.bestPercent ?? 0),
      'stats.perfectScores': increment(percent === 100 ? 1 : 0),
      'stats.streak': streak,
      'stats.lastStudyDay': today,
      'stats.xp': increment(r.xpEarned),
      daily: { ...daily, answered: daily.answered + r.total, bestPercent: Math.max(daily.bestPercent, percent) },
      ...(newBadges.length ? { badges: [...owned, ...newBadges] } : {}),
    });
  });
  return { id: attemptRef.id, newBadges };
}

/** Counts a chat question toward today's "Ask METANOIA" quest. */
export async function countQuestionAsked(uid: string) {
  await runTransaction(db, async (tx) => {
    const profile = (await tx.get(userDoc(uid))).data() as UserProfile | undefined;
    if (!profile) return;
    const d = todayProgress(profile);
    tx.update(userDoc(uid), { daily: { ...d, asked: d.asked + 1 } });
  });
}

/** Claims a finished daily quest (or the chest when all three are claimed). Returns XP added, 0 if not allowed. */
export async function claimDaily(uid: string, questId: string) {
  let added = 0;
  await runTransaction(db, async (tx) => {
    const profile = (await tx.get(userDoc(uid))).data() as UserProfile | undefined;
    if (!profile) return;
    const d = todayProgress(profile);
    if (d.claimed.includes(questId)) return;
    const quests = dailyQuests(profile);
    if (questId === 'chest') {
      if (!quests.every((q) => d.claimed.includes(q.id))) return;
      added = CHEST_XP;
    } else {
      const q = quests.find((x) => x.id === questId);
      if (!q || q.value < q.goal) return;
      added = q.xp;
    }
    tx.update(userDoc(uid), { daily: { ...d, claimed: [...d.claimed, questId] }, 'stats.xp': increment(added) });
  });
  return added;
}

/** Claims a journey goal or one-time reward (key must not be claimed yet). */
export async function claimReward(uid: string, key: string, xp: number, badge?: string) {
  let added = 0;
  await runTransaction(db, async (tx) => {
    const profile = (await tx.get(userDoc(uid))).data() as UserProfile | undefined;
    if (!profile || (profile.claimed ?? []).includes(key)) return;
    added = xp;
    const badges = new Set(profile.badges ?? []);
    if (badge) badges.add(badge);
    tx.update(userDoc(uid), { claimed: [...(profile.claimed ?? []), key], 'stats.xp': increment(xp), badges: [...badges] });
  });
  return added;
}

export const setAvatar = (uid: string, avatar: Avatar) => updateDoc(userDoc(uid), { avatar });

// ------------------------------------------------------------------ schedule
export async function replaceClasses(uid: string, classes: Omit<ClassItem, 'id'>[]) {
  const old = await getDocs(col(uid, 'classes'));
  const batch = writeBatch(db);
  old.forEach((d) => batch.delete(d.ref));
  classes.forEach((c) => batch.set(doc(col(uid, 'classes')), c));
  await batch.commit();
}

export const addClass = (uid: string, c: Omit<ClassItem, 'id'>) => addDoc(col(uid, 'classes'), c);
export const updateClass = (uid: string, id: string, c: Partial<ClassItem>) => updateDoc(doc(col(uid, 'classes'), id), c);
export const deleteClass = (uid: string, id: string) => deleteDoc(doc(col(uid, 'classes'), id));

// ------------------------------------------------------------------ exams
export function useExams(uid: string) {
  const r = useLive<ExamItem>(() => query(col(uid, 'exams')), `exams/${uid}`);
  return { ...r, data: [...r.data].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start) };
}
export const addExam = (uid: string, e: Omit<ExamItem, 'id'>) => addDoc(col(uid, 'exams'), e);
export const updateExam = (uid: string, id: string, e: Partial<ExamItem>) => updateDoc(doc(col(uid, 'exams'), id), e);
export const deleteExam = (uid: string, id: string) => deleteDoc(doc(col(uid, 'exams'), id));

// ------------------------------------------------------------------ chat
export const addMessage = (uid: string, role: ChatMessage['role'], text: string) =>
  addDoc(col(uid, 'messages'), { role, text, createdAt: serverTimestamp() });

export async function clearChat(uid: string) {
  const snap = await getDocs(col(uid, 'messages'));
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
