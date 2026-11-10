import { initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { setGlobalOptions } from 'firebase-functions';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/https';

import { AI_API_KEY, askAI, type Attachment } from './ai-provider.js';

initializeApp();
// Singapore is the closest region to the Philippines. Keep it the same as EXPO_PUBLIC_FUNCTIONS_REGION.
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 5 });

const opts = { secrets: [AI_API_KEY], timeoutSeconds: 120, memory: '512MiB' as const };

// ------------------------------------------------------------------ helpers
function requireUser(req: CallableRequest<unknown>) {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please log in first.');
  return req.auth.uid;
}

/** Reads an uploaded file, but only from the caller's own folder. */
async function readUpload(uid: string, path: string | null | undefined): Promise<Attachment | undefined> {
  if (!path) return undefined;
  if (!path.startsWith(`users/${uid}/uploads/`)) throw new HttpsError('permission-denied', 'That file is not yours.');
  const file = getStorage().bucket().file(path);
  const [[meta], [buf]] = await Promise.all([file.getMetadata(), file.download()]);
  return { mimeType: String(meta.contentType ?? 'application/octet-stream'), base64: buf.toString('base64') };
}

/** Pulls the first JSON value out of a model answer (models sometimes wrap it in ```json fences). */
function parseJson<T>(text: string): T {
  const m = text.match(/[[{][\s\S]*[\]}]/);
  try {
    return JSON.parse(m ? m[0] : text) as T;
  } catch {
    throw new HttpsError('internal', 'The AI answer could not be read. Please try again.');
  }
}

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// ------------------------------------------------------------------ generateReviewer
type GenIn = { title: string; sourceType: string; text?: string; storagePath?: string | null; count: number; difficulty: string };
type Q = { prompt: string; choices: string[]; answerIndex: number; explanation: string; topic: string };

export const generateReviewer = onCall(opts, async (req: CallableRequest<GenIn>) => {
  const uid = requireUser(req);
  const { title, text, storagePath, difficulty } = req.data;
  const count = clampInt(req.data.count, 3, 30, 10);
  if (!text?.trim() && !storagePath) throw new HttpsError('invalid-argument', 'Add your notes or a file.');
  if (text && text.length > 60_000) throw new HttpsError('invalid-argument', 'The notes are too long. Split them into smaller reviewers.');

  const attachment = await readUpload(uid, storagePath);
  const system =
    'You are METANOIA, a friendly study buddy for Filipino students. You write accurate multiple-choice reviewers ' +
    'ONLY from the lesson the student gives you. Use simple English. Reply with JSON only.';
  const user =
    `Lesson title: ${title}\nDifficulty: ${difficulty}\nNumber of questions: ${count}\n\n` +
    (text ? `Lesson notes:\n${text}\n\n` : 'The lesson is in the attached file.\n\n') +
    'Return exactly this JSON shape:\n' +
    '{"summary": ["3 to 5 short key points"], "questions": [{"prompt": "...", "choices": ["A", "B", "C", "D"], ' +
    '"answerIndex": 0, "explanation": "one sentence why", "topic": "short topic name"}]}\n' +
    'Rules: exactly 4 choices, one correct answer, vary answerIndex, 2 to 4 distinct topics.';

  const out = parseJson<{ summary: string[]; questions: Q[] }>(await askAI(system, user, attachment));
  const questions = (out.questions ?? [])
    .filter((q) => q && typeof q.prompt === 'string' && Array.isArray(q.choices) && q.choices.length >= 2 && q.answerIndex >= 0 && q.answerIndex < q.choices.length)
    .slice(0, count)
    .map((q, i) => ({ order: i, prompt: q.prompt, choices: q.choices.map(String), answerIndex: q.answerIndex, explanation: q.explanation ?? '', topic: q.topic || 'General' }));
  if (!questions.length) throw new HttpsError('internal', 'No questions were made. Try clearer notes.');
  return { summary: (out.summary ?? []).map(String).slice(0, 5), questions };
});

// ------------------------------------------------------------------ chatWithMetanoia
type Turn = { role: 'user' | 'bot'; text: string };
const GESTURES = ['wave', 'cheer', 'nod', 'no', 'think', 'dance', 'sleep'];

export const chatWithMetanoia = onCall(opts, async (req: CallableRequest<{ history: Turn[]; context: { firstName: string; weakTopic?: string; lang?: 'en' | 'tl' } }>) => {
  requireUser(req);
  const history = (req.data.history ?? []).slice(-12).map((t) => `${t.role === 'user' ? 'Student' : 'METANOIA'}: ${String(t.text).slice(0, 2000)}`);
  const { firstName, weakTopic, lang } = req.data.context ?? { firstName: 'there' };
  const system =
    `You are METANOIA, a kind robot study buddy for ${firstName}, a Filipino student. Explain simply, with short ` +
    'steps and local examples. Never do graded homework for them; guide them instead. ' +
    (lang === 'tl'
      ? 'Always reply in Tagalog (natural Taglish is OK, keep technical terms in English), even if the student writes in English. '
      : 'Always reply in clear, simple English, even if the student writes in Filipino. ') +
    (weakTopic ? `Their weakest topic lately is "${weakTopic}". ` : '') +
    `Reply as JSON: {"text": "your reply", "gesture": one of ${JSON.stringify(GESTURES)}}.`;
  const out = parseJson<{ text: string; gesture: string }>(await askAI(system, history.join('\n')));
  return { text: String(out.text ?? '').slice(0, 4000), gesture: GESTURES.includes(out.gesture) ? out.gesture : 'nod' };
});

// ------------------------------------------------------------------ scanSchedule
const COLORS = ['#6D28D9', '#15803D', '#C2410C', '#1D4ED8', '#BE185D', '#A16207', '#0E7490', '#334155'];

export const scanSchedule = onCall(opts, async (req: CallableRequest<{ storagePath: string | null }>) => {
  const uid = requireUser(req);
  const attachment = await readUpload(uid, req.data.storagePath);
  if (!attachment) throw new HttpsError('invalid-argument', 'Send a photo of the schedule.');
  const system = 'You read class schedules from photos. Reply with JSON only.';
  const user =
    'List every class in the attached schedule photo as JSON: [{"subject": "Mathematics", "code": "MATH", "day": 1, ' +
    '"start": 13, "end": 14, "room": "Rm 204", "teacher": "", "needsCheck": false}]. ' +
    'day: 1=Monday ... 7=Sunday, one entry per day the class meets. start/end are hours in 24h time (13.5 = 1:30 PM). ' +
    'Set needsCheck true when you are unsure about that entry.';
  const rows = parseJson<Array<Record<string, unknown>>>(await askAI(system, user, attachment));
  const codes = [...new Set(rows.map((r) => String(r.code ?? r.subject ?? '')))];
  return rows
    .map((r) => ({
      subject: String(r.subject ?? '').slice(0, 40),
      code: String(r.code ?? r.subject ?? '').slice(0, 6).toUpperCase(),
      color: COLORS[codes.indexOf(String(r.code ?? r.subject ?? '')) % COLORS.length],
      day: clampInt(r.day, 1, 7, 1),
      start: Number(r.start),
      end: Number(r.end),
      room: String(r.room ?? '').slice(0, 20),
      teacher: String(r.teacher ?? '').slice(0, 40),
      needsCheck: Boolean(r.needsCheck),
    }))
    .filter((c) => c.subject && c.start >= 0 && c.end > c.start && c.end <= 24);
});
