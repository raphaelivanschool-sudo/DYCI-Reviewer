import { AIError, getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel, type AI, type Part, type ThinkingConfig } from 'firebase/ai';

import { app } from './firebase';
import type { Attachment, ChatContext, ChatOutput, ChatTurn, GenerateInput, GenerateOutput, Gesture, ScannedClass, ScannedExam } from './ai';
import { matchSets, QUESTION_TYPES } from './question-types';
import type { Question, QuestionType } from './types';
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
          answers: Schema.array({ items: Schema.string() }),
          pairs: Schema.array({ items: Schema.object({ properties: { left: Schema.string(), right: Schema.string() } }) }),
          items: Schema.array({ items: Schema.string() }),
          explanation: Schema.string(),
          topic: Schema.string(),
        },
        optionalProperties: ['choices', 'answerIndex', 'answers', 'pairs', 'items'],
      }),
    }),
  },
  optionalProperties: ['summary'],
});

type RawQ = {
  prompt?: string; choices?: string[]; answerIndex?: number; answers?: string[];
  pairs?: { left?: string; right?: string }[]; items?: string[]; explanation?: string; topic?: string;
};

/** How to write each question type. `n` is the number of questions to ask for. */
const HOW: Record<QuestionType, (n: number) => string> = {
  mcq: (n) => `Write ${n} MULTIPLE CHOICE questions. Each has exactly 4 "choices" and one correct answer ("answerIndex" 0 to 3; vary it).`,
  tf: (n) => `Write ${n} TRUE OR FALSE statements in "prompt". "choices" must be ["True", "False"]; "answerIndex" 0 if the statement is true, 1 if false. Make about half of them false by changing one fact.`,
  fill: (n) => `Write ${n} FILL IN THE BLANKS items. "prompt" is a sentence from the lesson with one key word or short phrase replaced by "____" (exactly four underscores, once). "answers": the missing word first, then other accepted spellings or synonyms (1 to 3 in total).`,
  id: (n) => `Write ${n} IDENTIFICATION items. "prompt" describes a term, person, place or thing from the lesson without naming it. "answers": the term first, then other accepted names (1 to 3 in total).`,
  match: (n) => `Write ${n} MATCHING TYPE sets. "prompt" is a short instruction such as "Match each organelle with its job." "pairs": the {left, right} pairs of the set (use the exact number of pairs asked for each set). Every left and right must be different.`,
  enum: (n) => `Write ${n} ENUMERATION items. "prompt" asks the student to list a number of things and says how many (2 to 6), e.g. "Give the 3 states of matter." "answers": every item, short (1 to 4 words each).`,
  mtf: (n) => `Write ${n} MODIFIED TRUE OR FALSE statements. In "prompt" wrap exactly one key word in double asterisks, like "The heart has **three** chambers." "answerIndex" 0 if the statement is true, 1 if false. If false, "answers" is [the word that makes it true]; if true, "answers" is []. Make about half false by changing only the marked word.`,
  seq: (n) => `Write ${n} SEQUENCING items. "prompt" says what to put in order (steps, events or stages). "items": 3 to 6 short steps in the CORRECT order.`,
};

/** Checks one AI question for its type and turns it into a saved question, or null if it is broken. */
function toQuestion(type: QuestionType, q: RawQ): Omit<Question, 'id' | 'order'> | null {
  const prompt = String(q.prompt ?? '').trim();
  const words = (a?: unknown[]) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean) : []);
  const base = { type, prompt, explanation: String(q.explanation ?? ''), topic: String(q.topic || 'General'), choices: [] as string[], answerIndex: 0 };
  if (!prompt) return null;
  switch (type) {
    case 'mcq': {
      const choices = words(q.choices);
      if (choices.length < 2 || typeof q.answerIndex !== 'number' || q.answerIndex < 0 || q.answerIndex >= choices.length) return null;
      return { ...base, choices, answerIndex: q.answerIndex };
    }
    case 'tf':
      return q.answerIndex === 0 || q.answerIndex === 1 ? { ...base, choices: ['True', 'False'], answerIndex: q.answerIndex } : null;
    case 'mtf': {
      if (!/\*\*.+?\*\*/.test(prompt) || (q.answerIndex !== 0 && q.answerIndex !== 1)) return null;
      const answers = words(q.answers);
      if (q.answerIndex === 1 && !answers.length) return null;
      return { ...base, choices: ['True', 'False'], answerIndex: q.answerIndex, answers: q.answerIndex === 1 ? answers.slice(0, 3) : [] };
    }
    case 'fill':
    case 'id': {
      const answers = words(q.answers).slice(0, 4);
      if (!answers.length || (type === 'fill' && !prompt.includes('__'))) return null;
      return { ...base, prompt: type === 'fill' ? prompt.replace(/_{2,}/, '____') : prompt, answers };
    }
    case 'enum': {
      const answers = words(q.answers).slice(0, 8);
      return answers.length >= 2 ? { ...base, answers } : null;
    }
    case 'match': {
      const pairs = (q.pairs ?? []).map((p) => ({ left: String(p.left ?? '').trim(), right: String(p.right ?? '').trim() })).filter((p) => p.left && p.right);
      return pairs.length >= 2 ? { ...base, pairs } : null;
    }
    case 'seq': {
      const items = words(q.items).slice(0, 8);
      return items.length >= 3 ? { ...base, items } : null;
    }
  }
}

/**
 * One Gemini request per question type (in parallel): a focused prompt per type is far more reliable
 * than asking for a big mixed list. The parts come back in the picker's order, like the parts of an exam.
 */
export async function geminiGenerate(input: GenerateInput): Promise<GenerateOutput> {
  const system =
    'You are METANOIA, a friendly study buddy for Filipino students. Write accurate reviewer questions ' +
    'ONLY from the lesson the student gives you. Do not invent facts that are not in the lesson. Use simple English.';
  const lesson =
    `Lesson title: ${input.title}\nDifficulty: ${input.difficulty}\n\n` +
    (input.text
      ? `Lesson notes:\n${input.text}\n\n`
      : (input.attachments?.length ?? 0) > 1
        ? `The lesson is in the ${input.attachments?.length} attached photos, in order. Use all of them.\n\n`
        : 'The lesson is in the attached file.\n\n');
  const files = (input.attachments ?? []).map(filePart);
  const parts = QUESTION_TYPES.map((t) => t.id).filter((t) => (input.types[t] ?? 0) > 0);

  const results = await Promise.all(
    parts.map(async (type, i) => {
      const n = input.types[type] ?? 0;
      const sets = type === 'match' ? matchSets(n) : [];
      const prompt =
        lesson +
        HOW[type](type === 'match' ? sets.length : n) +
        (type === 'match' ? ` Pairs per set, in order: ${sets.join(', ')}.` : '') +
        ' Spread the questions over the whole lesson and do not repeat a question. Group them into 2 to 4 short topic names. Explanation: one sentence.' +
        (i === 0 ? ' Also give 3 to 5 short key points of the lesson as "summary".' : ' Leave "summary" out.');
      const out = await ask<{ summary?: string[]; questions?: RawQ[] }>(system, REVIEWER_SCHEMA, [textPart(prompt), ...files]);
      let qs = (out.questions ?? []).map((q) => toQuestion(type, q)).filter((q): q is NonNullable<typeof q> => !!q);
      if (type === 'match') {
        // Trim pairs so the matching part has exactly the number of items asked for.
        let left = n;
        qs = qs
          .map((q) => {
            const pairs = (q.pairs ?? []).slice(0, Math.max(0, left));
            left -= pairs.length;
            return { ...q, pairs };
          })
          .filter((q) => (q.pairs?.length ?? 0) >= 2);
      } else qs = qs.slice(0, n);
      return { summary: out.summary ?? [], questions: qs };
    }),
  );

  const questions = results.flatMap((r) => r.questions).map((q, order) => ({ ...q, order }));
  if (!questions.length) throw new Error('No questions were made. Try clearer or longer notes.');
  return { summary: results.flatMap((r) => r.summary).map(String).slice(0, 5), questions };
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
