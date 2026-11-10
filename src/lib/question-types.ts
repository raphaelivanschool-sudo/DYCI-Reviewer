import type { Question, QuestionType } from './types';

/** Every question type a reviewer can have, in the order the picker shows them. */
export const QUESTION_TYPES: { id: QuestionType; label: string; badge: string; hint: string }[] = [
  { id: 'mcq', label: 'Multiple choice', badge: 'A·B', hint: 'Pick the right answer from 4' },
  { id: 'fill', label: 'Fill in the blanks', badge: '__', hint: 'Type the missing word' },
  { id: 'tf', label: 'True or False', badge: 'T/F', hint: 'Is the statement right?' },
  { id: 'id', label: 'Identification', badge: 'ID', hint: 'Type the term being described' },
  { id: 'match', label: 'Matching type', badge: '⇄', hint: 'Pair each item with its match' },
  { id: 'enum', label: 'Enumeration', badge: '1·2·3', hint: 'List all the answers' },
  { id: 'mtf', label: 'Modified True or False', badge: 'T/F✎', hint: 'If false, fix the underlined word' },
  { id: 'seq', label: 'Sequencing', badge: '↕', hint: 'Put the steps in order' },
];

export const typeLabel = (t?: QuestionType) => QUESTION_TYPES.find((x) => x.id === (t ?? 'mcq'))?.label ?? 'Multiple choice';

/** Questions saved before question types existed are multiple choice. */
export const typeOf = (q: Pick<Question, 'type'>): QuestionType => q.type ?? 'mcq';

/** Mix: number of items per type. Only types with at least 1 item are used. */
export type TypeCounts = Partial<Record<QuestionType, number>>;
export const MIX_MIN = 5;
export const MIX_MAX = 100;
export const totalOf = (counts: TypeCounts) => Object.values(counts).reduce((a, n) => a + (n ?? 0), 0);

/** Points a question is worth: every pair of a matching set is one item, everything else is 1. */
export const pointsOf = (q: Pick<Question, 'type' | 'pairs'>) => (typeOf(q) === 'match' ? Math.max(1, q.pairs?.length ?? 1) : 1);

/** Pairs per matching set. "Matching 12 items" becomes sets of 5 + 5 + 2 → 5, 4, 3 (no set smaller than 3). */
export const MATCH_SET = 5;
export function matchSets(items: number) {
  const sets = Math.max(1, Math.ceil(items / MATCH_SET));
  return Array.from({ length: sets }, (_, i) => Math.floor(items / sets) + (i < items % sets ? 1 : 0));
}

// ------------------------------------------------------------------ checking typed answers

/** Lowercase, no accents, no punctuation, no leading "the/a/an", single spaces. */
export function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/^\s*(the|a|an|ang|si|mga)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function distance(a: string, b: string) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * Is a typed answer right? Capitalization, punctuation and small typos are forgiven
 * (1 letter for words of 5+ letters, 2 letters for 10+), so spelling slips don't cost the point.
 */
export function matches(given: string, accepted: string[]) {
  const g = normalize(given);
  if (!g) return false;
  return accepted.some((a) => {
    const n = normalize(a);
    if (!n) return false;
    const allowed = n.length >= 10 ? 2 : n.length >= 5 ? 1 : 0;
    return distance(g, n) <= allowed;
  });
}

/** Enumeration: every expected item must be given once, in any order. */
export function enumCorrect(given: string[], expected: string[]) {
  const left = [...expected];
  for (const g of given) {
    const i = left.findIndex((e) => matches(g, [e]));
    if (i < 0) return false;
    left.splice(i, 1);
  }
  return left.length === 0;
}

/** The right answer in words, shown after the student answers. */
export function correctAnswerText(q: Question) {
  switch (typeOf(q)) {
    case 'fill':
    case 'id':
      return q.answers?.[0] ?? '';
    case 'enum':
      return (q.answers ?? []).join(', ');
    case 'mtf':
      return q.answerIndex === 0 ? 'True' : `False → ${q.answers?.[0] ?? ''}`;
    case 'match':
      return (q.pairs ?? []).map((p) => `${p.left} = ${p.right}`).join(' · ');
    case 'seq':
      return (q.items ?? []).map((s, i) => `${i + 1}. ${s}`).join('  ');
    default:
      return q.choices[q.answerIndex] ?? '';
  }
}

/** Splits "The heart has **three** chambers." into plain and underlined parts. */
export function underlineParts(prompt: string) {
  return prompt.split(/\*\*(.+?)\*\*/g).map((text, i) => ({ text, underline: i % 2 === 1 }));
}
