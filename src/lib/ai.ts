import { httpsCallable } from 'firebase/functions';

import { geminiChat, geminiGenerate, geminiScan, geminiScanExam } from './ai-gemini';
import { functions } from './firebase';
import { SAMPLE_QUESTIONS, SAMPLE_WEEK } from './sample-data';
import type { ClassItem, Difficulty, Question, SourceType } from './types';

/**
 * All AI goes through this file. Screens never need to change when you switch modes.
 *  - EXPO_PUBLIC_AI_MODE=mock (default): simple rules on the phone, no AI, free.
 *  - EXPO_PUBLIC_AI_MODE=gemini: Gemini through Firebase AI Logic (ai-gemini.ts). No API key in the
 *    app and no Cloud Functions needed; works on the free Spark plan.
 *  - EXPO_PUBLIC_AI_MODE=functions: your own Cloud Functions in /functions (needs the Blaze plan).
 */
export type AIMode = 'mock' | 'gemini' | 'functions';
const RAW_MODE = process.env.EXPO_PUBLIC_AI_MODE;
export const AI_MODE: AIMode = RAW_MODE === 'gemini' || RAW_MODE === 'functions' ? RAW_MODE : 'mock';

/** Can this mode read uploaded files and photos itself? */
export const AI_READS_FILES = AI_MODE !== 'mock';

/** A file sent straight to the AI (PDF, text or image), base64 without the data: prefix. */
export type Attachment = { mimeType: string; base64: string };

/** Mime types Gemini can read from an attachment. Word/PowerPoint must be saved as PDF first. */
export const READABLE_TYPES = ['application/pdf', 'text/plain'];
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/** Rejects with `message` if `p` takes longer than `ms`, so screens never wait forever. */
export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

/** Reads a local file (file:// on phones, blob: on web) as base64. */
export async function readAsBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('This file is too big. Use a file under 15 MB.');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.readAsDataURL(blob);
  });
}

export type Gesture = 'wave' | 'cheer' | 'nod' | 'no' | 'think' | 'dance' | 'sleep';

export type GenerateInput = {
  title: string;
  sourceType: SourceType;
  text?: string;
  storagePath?: string | null; // functions mode: uploaded file in Cloud Storage
  attachments?: Attachment[]; // gemini mode: the file, or several photos of notes
  count: number;
  difficulty: Difficulty;
};
export type GenerateOutput = { summary: string[]; questions: Omit<Question, 'id'>[] };

export async function generateReviewer(input: GenerateInput): Promise<GenerateOutput> {
  if (AI_MODE === 'functions') {
    const { attachments: _a, ...rest } = input;
    const res = await httpsCallable<Omit<GenerateInput, 'attachments'>, GenerateOutput>(functions, 'generateReviewer')(rest);
    return res.data;
  }
  if (AI_MODE === 'gemini') return withTimeout(geminiGenerate(input), input.count > 30 ? 210_000 : 120_000, 'Gemini is taking too long. Try shorter notes or try again.');
  await wait(1600);
  return mockGenerate(input);
}

export type ChatTurn = { role: 'user' | 'bot'; text: string };
export type ChatOutput = { text: string; gesture: Gesture };

/** lang: the language METANOIA must answer in (English unless the student switched to Tagalog). */
export type ChatContext = { firstName: string; weakTopic?: string; lang?: 'en' | 'tl' };

export async function chatReply(history: ChatTurn[], context: ChatContext): Promise<ChatOutput> {
  if (AI_MODE === 'functions') {
    const res = await httpsCallable<{ history: ChatTurn[]; context: typeof context }, ChatOutput>(functions, 'chatWithMetanoia')({ history, context });
    return res.data;
  }
  if (AI_MODE === 'gemini') return withTimeout(geminiChat(history, context), 60_000, 'Gemini did not answer in 60 seconds. Check your internet and try again.');
  await wait(900);
  return mockChat(history[history.length - 1]?.text ?? '', context);
}

export type ScannedClass = Omit<ClassItem, 'id'> & { needsCheck?: boolean };

export async function scanSchedule(photo: { storagePath?: string | null; attachment?: Attachment }): Promise<ScannedClass[]> {
  if (AI_MODE === 'functions') {
    const res = await httpsCallable<{ storagePath: string | null }, ScannedClass[]>(functions, 'scanSchedule')({ storagePath: photo.storagePath ?? null });
    return res.data;
  }
  if (AI_MODE === 'gemini') {
    if (!photo.attachment) throw new Error('No photo to read.');
    return withTimeout(geminiScan(photo.attachment), 90_000, 'Gemini is taking too long to read the photo. Try again.');
  }
  await wait(1800);
  // The mock cannot read the photo, so it returns a typical Grade 10 week to edit.
  return SAMPLE_WEEK.map((c) => ({ ...c, needsCheck: c.code === 'ESP' }));
}

/** What the AI read from a teacher's exam notice. Every field may be missing. */
export type ScannedExam = { subject?: string; title?: string; date?: string; start?: number; end?: number; room?: string; notes?: string };

/** Reads an exam notice (photo, screenshot, PDF) and pulls out the exam details and coverage. */
export async function scanExamNotice(files: Attachment[]): Promise<ScannedExam> {
  if (AI_MODE === 'gemini') return withTimeout(geminiScanExam(files), 90_000, 'Gemini is taking too long to read it. Try again.');
  throw new Error(AI_MODE === 'mock'
    ? 'Practice mode can’t read photos or files. Set EXPO_PUBLIC_AI_MODE=gemini to use this, or type the details.'
    : 'Reading exam notices needs EXPO_PUBLIC_AI_MODE=gemini.');
}

// ------------------------------------------------------------------ mock implementations
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const DEFINITION = /^(.{3,60}?)\s+(is|are|refers to|means|was|were)\s+(.{8,})$/i;

/** Turns "X is Y." sentences from pasted notes into multiple-choice questions. */
function mockGenerate(input: GenerateInput): GenerateOutput {
  const text = (input.text ?? '').trim();
  const facts: { term: string; def: string; topic: string }[] = [];
  text.split(/\n\s*\n/).forEach((para, pi) => {
    const lines = para.trim().split('\n');
    // A short first line without a period is a heading: use it as the topic, not as a sentence.
    const hasHeading = lines.length > 1 && lines[0].length < 50 && !/[.?!]$/.test(lines[0].trim());
    const heading = hasHeading ? lines[0].replace(/^#+\s*/, '').trim() : `Section ${pi + 1}`;
    (hasHeading ? lines.slice(1).join(' ') : para)
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .forEach((sentence) => {
        const m = sentence.trim().replace(/[.!?]$/, '').match(DEFINITION);
        if (m) facts.push({ term: m[1].replace(/^(the|a|an)\s+/i, ''), def: m[3], topic: heading });
      });
  });

  if (facts.length < 4) {
    // Not enough definitions (or a file/photo the mock cannot read): use the sample bank.
    const qs = shuffle(SAMPLE_QUESTIONS).slice(0, input.count).map((q, i) => ({ ...q, order: i }));
    return {
      summary: ['Sports safety means warming up, using the right gear, and knowing the rules.', 'Team sports depend on clear roles and fair play.', 'Rest and water help your body recover after activity.'],
      questions: qs,
    };
  }

  const defs = facts.map((f) => f.def);
  const questions = shuffle(facts)
    .slice(0, input.count)
    .map((f, i) => {
      const wrong = shuffle(defs.filter((d) => d !== f.def)).slice(0, 3);
      const choices = shuffle([f.def, ...wrong]);
      return {
        order: i,
        prompt: `Which of these best describes ${f.term}?`,
        choices,
        answerIndex: choices.indexOf(f.def),
        explanation: `${f.term[0].toUpperCase()}${f.term.slice(1)} ${f.def}.`,
        topic: f.topic,
      };
    });
  return { summary: facts.slice(0, 3).map((f) => `${f.term}: ${f.def}.`), questions };
}

function mockChat(message: string, ctx: ChatContext): ChatOutput {
  if (ctx.lang === 'tl') return mockChatTl(message, ctx);
  const m = message.toLowerCase();
  const topic = ctx.weakTopic ?? 'your last reviewer';
  if (/^(hi|hello|hey|kumusta|musta)/.test(m)) return { text: `Hi ${ctx.firstName}! What do you want to review today?`, gesture: 'wave' };
  if (m.includes('explain') || m.includes('weak'))
    return {
      text: `Sure! Let's look at ${topic} in a simpler way:\n\n1. Read the question twice and find the key word.\n2. Connect it to an example you know.\n3. Remove the choices that are clearly wrong first.\n\nWant me to quiz you on ${topic}?`,
      gesture: 'think',
    };
  if (m.includes('quiz')) return { text: `Here's a quick one about ${topic}:\n\nWhat should you always do before playing a sport?\nA. Eat a big meal\nB. Warm up and stretch\nC. Skip water\n\nReply with A, B or C!`, gesture: 'nod' };
  if (/^\s*b\b/.test(m)) return { text: 'Correct! Warming up gets your muscles ready and lowers the risk of injury. Great job!', gesture: 'cheer' };
  if (/^\s*[ac]\b/.test(m)) return { text: 'Not quite. The answer is B: warm up and stretch. You will get the next one!', gesture: 'no' };
  if (m.includes('summar')) return { text: 'Here is a short summary:\n• Warm up before activity.\n• Use the right equipment.\n• Follow the rules and listen to your coach.\n• Rest and drink water after.', gesture: 'nod' };
  if (m.includes('tired') || m.includes('pagod') || m.includes('sleep')) return { text: 'Take a short 5-minute break, drink water, then we continue. You are doing great!', gesture: 'sleep' };
  return { text: "Good question! I'm in practice mode right now, so my answers are simple. Try: \"Explain my weak topic\", \"Quiz me\" or \"Summarize my lesson\".", gesture: 'think' };
}

function mockChatTl(message: string, ctx: ChatContext): ChatOutput {
  const m = message.toLowerCase();
  const topic = ctx.weakTopic ?? 'huling reviewer mo';
  if (/^(hi|hello|hey|kumusta|musta)/.test(m)) return { text: `Hi ${ctx.firstName}! Ano ang gusto mong i-review ngayon?`, gesture: 'wave' };
  if (m.includes('explain') || m.includes('weak') || m.includes('ipaliwanag'))
    return {
      text: `Sige! Tingnan natin ang ${topic} sa mas simpleng paraan:\n\n1. Basahin nang dalawang beses ang tanong at hanapin ang key word.\n2. Iugnay ito sa example na alam mo.\n3. Tanggalin muna ang mga choice na halatang mali.\n\nGusto mo bang i-quiz kita sa ${topic}?`,
      gesture: 'think',
    };
  if (m.includes('quiz')) return { text: `Eto ang isang mabilis na tanong tungkol sa ${topic}:\n\nAno ang dapat gawin bago maglaro ng sport?\nA. Kumain nang marami\nB. Mag-warm up at mag-stretch\nC. Huwag uminom ng tubig\n\nSagot ka ng A, B o C!`, gesture: 'nod' };
  if (/^\s*b\b/.test(m)) return { text: 'Tama! Hinahanda ng warm-up ang muscles mo at binabawasan ang risk ng injury. Galing!', gesture: 'cheer' };
  if (/^\s*[ac]\b/.test(m)) return { text: 'Hindi pa. Ang sagot ay B: mag-warm up at mag-stretch. Kaya mo ’yan sa susunod!', gesture: 'no' };
  if (m.includes('summar') || m.includes('buod')) return { text: 'Eto ang maikling buod:\n• Mag-warm up bago mag-activity.\n• Gamitin ang tamang equipment.\n• Sundin ang rules at makinig sa coach.\n• Magpahinga at uminom ng tubig pagkatapos.', gesture: 'nod' };
  if (m.includes('tired') || m.includes('pagod') || m.includes('antok')) return { text: 'Pahinga ka muna ng 5 minuto, uminom ng tubig, tapos tuloy tayo. Ang galing mo!', gesture: 'sleep' };
  return { text: 'Magandang tanong! Nasa practice mode ako ngayon, kaya simple lang ang sagot ko. Subukan: "Ipaliwanag ang weak topic ko", "Quiz me" o "Summarize my lesson".', gesture: 'think' };
}
