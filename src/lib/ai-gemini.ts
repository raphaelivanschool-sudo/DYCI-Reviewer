import { AIError, getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel, type AI, type Part, type ThinkingConfig } from 'firebase/ai';

import { app } from './firebase';
import type { Attachment, ChatContext, ChatOutput, ChatTurn, GenerateInput, GenerateOutput, Gesture, ScannedClass, ScannedExam } from './ai';
import { SUBJECT_COLORS } from '@/theme';

/**
 * Gemini through Firebase AI Logic (Gemini Developer API backend).
 * The app never holds a Gemini API key: Firebase calls Gemini on the project's behalf.
 * Turn it on once in Firebase console › AI Logic › Get started › Gemini Developer API.
 */
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';
const GESTURES: Gesture[] = ['wave', 'cheer', 'nod', 'no', 'think', 'dance', 'sleep'];

/**
 * How long Gemini "thinks" before answering. Less thinking = much faster replies.
 * Chat uses the least; reviewers and schedule reading use a little more for accuracy.
 * Gemini 3.x uses thinkingLevel; Gemini 2.5 only understands thinkingBudget.
 */
type Effort = 'fast' | 'careful';
function thinking(effort: Effort): ThinkingConfig {
  if (/^gemini-2\./.test(MODEL)) return { thinkingBudget: effort === 'fast' ? 0 : 1024 };
  return { thinkingLevel: effort === 'fast' ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW };
}

let ai: AI | null = null;
const model = (system: string, schema: Schema, effort: Effort) =>
  getGenerativeModel((ai ??= getAI(app, { backend: new GoogleAIBackend() })), {
    model: MODEL,
    systemInstruction: system,
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, thinkingConfig: thinking(effort) },
  });

const textPart = (text: string): Part => ({ type: 'text', text });
const filePart = (a: Attachment): Part => ({ type: 'inlineData', inlineData: { mimeType: a.mimeType, data: a.base64 } });

async function ask<T>(system: string, schema: Schema, parts: Part[], effort: Effort = 'careful'): Promise<T> {
  try {
    const res = await model(system, schema, effort).generateContent(parts);
    return JSON.parse(res.response.text()) as T;
  } catch (e) {
    throw new Error(friendly(e));
  }
}

/** Short messages a student (or the team) can act on. */
function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if ((e instanceof AIError && e.code === 'api-not-enabled') || /SERVICE_DISABLED|has not been used|API_NOT_ENABLED|is disabled/i.test(msg))
    return 'Gemini is not turned on yet. In the Firebase console open AI Logic › Get started › Gemini Developer API.';
  if (/app.?check/i.test(msg))
    return process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN
      ? 'App Check rejected the debug token. Check that EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN matches a token in Firebase console › App Check › Apps › Manage debug tokens.'
      : 'Gemini needs App Check. Add a debug token: Firebase console › App Check › Apps › ⋮ › Manage debug tokens, then put it in .env as EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN.';
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return 'METANOIA is busy right now (free AI limit reached). Wait a minute and try again.';
  if (/model/i.test(msg) && /404|not found|not supported/i.test(msg))
    return `The AI model "${MODEL}" was not found. Set EXPO_PUBLIC_GEMINI_MODEL in .env to a model listed in Firebase AI Logic.`;
  if (/API key not valid|API_KEY_INVALID/i.test(msg)) return 'The Firebase API key in .env is wrong. Copy it again from Project settings.';
  if (/Failed to fetch|Network request failed|NetworkError|ERR_INTERNET/i.test(msg)) return 'No internet connection. Check it and try again.';
  if (e instanceof SyntaxError) return 'The AI answer could not be read. Please try again.';
  return `AI error: ${msg.slice(0, 200)}`;
}

// ------------------------------------------------------------------ reviewer
const REVIEWER_SCHEMA = Schema.object({
  properties: {
    summary: Schema.array({ items: Schema.string() }),
    questions: Schema.array({
      items: Schema.object({
        properties: {
          prompt: Schema.string(),
          choices: Schema.array({ items: Schema.string() }),
          answerIndex: Schema.integer(),
          explanation: Schema.string(),
          topic: Schema.string(),
        },
      }),
    }),
  },
});

type RawQ = { prompt?: string; choices?: string[]; answerIndex?: number; explanation?: string; topic?: string };

export async function geminiGenerate(input: GenerateInput): Promise<GenerateOutput> {
  const system =
    'You are METANOIA, a friendly study buddy for Filipino students. Write accurate multiple-choice reviewers ' +
    'ONLY from the lesson the student gives you. Do not invent facts that are not in the lesson. Use simple English.';
  const ask_ =
    `Lesson title: ${input.title}\nDifficulty: ${input.difficulty}\nNumber of questions: ${input.count}\n\n` +
    (input.text
      ? `Lesson notes:\n${input.text}\n\n`
      : (input.attachments?.length ?? 0) > 1
        ? `The lesson is in the ${input.attachments?.length} attached photos, in order. Use all of them.\n\n`
        : 'The lesson is in the attached file.\n\n') +
    'Give 3 to 5 short key points as "summary". Each question has exactly 4 choices and one correct answer ' +
    '(answerIndex is 0 to 3; vary it). Group questions into 2 to 4 short topic names. Explanation: one sentence.';
  const parts = [textPart(ask_), ...(input.attachments ?? []).map(filePart)];
  const out = await ask<{ summary?: string[]; questions?: RawQ[] }>(system, REVIEWER_SCHEMA, parts);

  const questions = (out.questions ?? [])
    .filter((q) => q.prompt && Array.isArray(q.choices) && q.choices.length >= 2 && typeof q.answerIndex === 'number' && q.answerIndex >= 0 && q.answerIndex < q.choices.length)
    .slice(0, input.count)
    .map((q, i) => ({ order: i, prompt: q.prompt!, choices: q.choices!.map(String), answerIndex: q.answerIndex!, explanation: q.explanation ?? '', topic: q.topic || 'General' }));
  if (!questions.length) throw new Error('No questions were made. Try clearer or longer notes.');
  return { summary: (out.summary ?? []).map(String).slice(0, 5), questions };
}

// ------------------------------------------------------------------ chat
const CHAT_SCHEMA = Schema.object({
  properties: {
    text: Schema.string(),
    gesture: Schema.enumString({ enum: GESTURES }),
  },
});

export async function geminiChat(history: ChatTurn[], ctx: ChatContext): Promise<ChatOutput> {
  const system =
    `You are METANOIA, the kind robot study buddy inside the METAKNOWIA study app, talking with ${ctx.firstName}, a Filipino student. Keep replies short (1 to 4 sentences unless asked for more). Explain simply with short steps ` +
    'and local examples. Never just do graded homework; guide them. ' +
    (ctx.lang === 'tl'
      ? 'Always reply in Tagalog (natural Taglish is OK, keep technical terms in English), even if the student writes in English. '
      : 'Always reply in clear, simple English, even if the student writes in Filipino. ') +
    (ctx.weakTopic ? `Their weakest topic lately is "${ctx.weakTopic}". ` : '') +
    'Pick the robot gesture that fits your reply: wave (greeting), cheer (praise), nod (agree/explain), no (correcting), ' +
    'think (explaining something hard), dance (fun/break), sleep (rest).';
  const transcript = history.slice(-12).map((t) => `${t.role === 'user' ? 'Student' : 'METANOIA'}: ${t.text.slice(0, 2000)}`).join('\n');
  const out = await ask<{ text?: string; gesture?: string }>(system, CHAT_SCHEMA, [textPart(`${transcript}\nMETANOIA:`)], 'fast');
  const gesture = GESTURES.includes(out.gesture as Gesture) ? (out.gesture as Gesture) : 'nod';
  return { text: String(out.text ?? '').slice(0, 4000) || 'Sorry, can you ask that again?', gesture };
}

// ------------------------------------------------------------------ schedule photo
const SCHEDULE_SCHEMA = Schema.array({
  items: Schema.object({
    properties: {
      subject: Schema.string(),
      code: Schema.string(),
      day: Schema.integer({ description: '1=Monday … 7=Sunday' }),
      start: Schema.number({ description: '24h hours, 13.5 = 1:30 PM' }),
      end: Schema.number(),
      room: Schema.string(),
      teacher: Schema.string(),
      needsCheck: Schema.boolean(),
    },
    optionalProperties: ['room', 'teacher', 'needsCheck', 'code'],
  }),
});

type RawClass = { subject?: string; code?: string; day?: number; start?: number; end?: number; room?: string; teacher?: string; needsCheck?: boolean };

export async function geminiScan(photo: Attachment): Promise<ScannedClass[]> {
  const system = 'You read class schedules from photos accurately.';
  const prompt =
    'List every class in this schedule photo. Make one entry per day the class meets. day: 1=Monday … 7=Sunday. ' +
    'start/end: hours in 24h time (13.5 = 1:30 PM). code: a short subject code like MATH or ENG. ' +
    'Set needsCheck true when you are unsure about that entry.';
  const rows = await ask<RawClass[]>(system, SCHEDULE_SCHEMA, [textPart(prompt), filePart(photo)]);
  const codes = [...new Set(rows.map((r) => String(r.code || r.subject || '')))];
  return rows
    .map((r) => ({
      subject: String(r.subject ?? '').slice(0, 40),
      code: String(r.code || r.subject || '').slice(0, 6).toUpperCase(),
      color: SUBJECT_COLORS[codes.indexOf(String(r.code || r.subject || '')) % SUBJECT_COLORS.length],
      day: Math.min(7, Math.max(1, Math.round(Number(r.day) || 1))),
      start: Number(r.start),
      end: Number(r.end),
      room: String(r.room ?? '').slice(0, 20),
      teacher: String(r.teacher ?? '').slice(0, 40),
      needsCheck: Boolean(r.needsCheck),
    }))
    .filter((c) => c.subject && c.start >= 0 && c.end > c.start && c.end <= 24);
}

// ------------------------------------------------------------------ exam notice
const EXAM_SCHEMA = Schema.object({
  properties: {
    subject: Schema.string(),
    title: Schema.string({ description: 'Type of exam, e.g. Midterm, Prelim, Quarterly exam, Long test' }),
    date: Schema.string({ description: 'YYYY-MM-DD' }),
    start: Schema.number({ description: '24h hours, 13.5 = 1:30 PM' }),
    end: Schema.number(),
    room: Schema.string(),
    notes: Schema.string({ description: 'What to review: the topics, chapters or pages covered' }),
  },
  optionalProperties: ['subject', 'title', 'date', 'start', 'end', 'room', 'notes'],
});

export async function geminiScanExam(files: Attachment[]): Promise<ScannedExam> {
  const system = 'You read exam announcements, coverage lists and test schedules that teachers send to students.';
  const prompt =
    `Today is ${new Date().toDateString()}. Read the attached exam notice. Fill in only what it actually says; leave a field out if it is not there. ` +
    'date: YYYY-MM-DD (if no year is written, use the next date that is not in the past). start/end: hours in 24h time (13.5 = 1:30 PM). ' +
    'notes: a short list of the topics, lessons, chapters or pages covered, one per line, starting with "• ".';
  const out = await ask<ScannedExam>(system, EXAM_SCHEMA, [textPart(prompt), ...files.map(filePart)]);
  const hours = (v: unknown) => (typeof v === 'number' && v >= 0 && v <= 24 ? v : undefined);
  return {
    subject: out.subject ? String(out.subject).slice(0, 40) : undefined,
    title: out.title ? String(out.title).slice(0, 40) : undefined,
    date: typeof out.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(out.date) ? out.date : undefined,
    start: hours(out.start),
    end: hours(out.end),
    room: out.room ? String(out.room).slice(0, 20) : undefined,
    notes: out.notes ? String(out.notes).slice(0, 1500) : undefined,
  };
}
