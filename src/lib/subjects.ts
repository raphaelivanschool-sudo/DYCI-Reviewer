import { PALETTE, tintOf } from '@/theme';

import type { ClassItem, Folder, GradeLevel } from './types';

export type SubjectPick = { subject: string; code?: string; color: string };

const pick = (subject: string, code: string, i: number): SubjectPick => ({ subject, code, color: PALETTE[(i * 5) % PALETTE.length] });

/** Common subjects per grade level, only used as quick picks. Students can always type their own. */
const COMMON: Record<GradeLevel, SubjectPick[]> = {
  Elementary: [
    ['English', 'ENG'], ['Mathematics', 'MATH'], ['Science', 'SCI'], ['Filipino', 'FIL'], ['Araling Panlipunan', 'AP'],
    ['MAPEH', 'MAPEH'], ['GMRC', 'GMRC'], ['EPP', 'EPP'],
  ].map(([s, c], i) => pick(s, c, i)),
  'High School': [
    ['English', 'ENG'], ['Mathematics', 'MATH'], ['Science', 'SCI'], ['Filipino', 'FIL'], ['Araling Panlipunan', 'AP'],
    ['MAPEH', 'MAPEH'], ['TLE', 'TLE'], ['Values Education', 'VE'],
  ].map(([s, c], i) => pick(s, c, i)),
  'Senior High': [
    ['Oral Communication', 'ORALCOM'], ['General Mathematics', 'GENMATH'], ['Statistics and Probability', 'STATS'],
    ['Earth and Life Science', 'ELS'], ['Komunikasyon at Pananaliksik', 'KOMPAN'], ['21st Century Literature', 'LIT'],
    ['Understanding Culture, Society and Politics', 'UCSP'], ['Personal Development', 'PERDEV'], ['PE and Health', 'PEH'],
    ['Empowerment Technologies', 'ETECH'],
  ].map(([s, c], i) => pick(s, c, i)),
  College: [
    ['Purposive Communication', 'PURCOM'], ['Mathematics in the Modern World', 'MMW'], ['Understanding the Self', 'UTS'],
    ['Readings in Philippine History', 'RPH'], ['The Contemporary World', 'TCW'], ['Science, Technology and Society', 'STS'],
    ['Art Appreciation', 'ARTAPP'], ['Ethics', 'ETHICS'], ['PATHFit', 'PE'], ['NSTP', 'NSTP'],
  ].map(([s, c], i) => pick(s, c, i)),
};

/**
 * Quick picks for a subject field: the student's own subjects first (their classes and Subjects),
 * then the common ones for their grade level. No duplicates, compared without letter case.
 */
export function subjectPicks(grade: GradeLevel | undefined, classes: Pick<ClassItem, 'subject' | 'code' | 'color'>[], folders: Folder[], max = 12): SubjectPick[] {
  const seen = new Set<string>();
  const out: SubjectPick[] = [];
  const add = (p: SubjectPick) => {
    const k = p.subject.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  classes.forEach((c) => add({ subject: c.subject, code: c.code, color: c.color }));
  folders.forEach((f) => add({ subject: f.name, color: tintOf(f.tint).fg }));
  COMMON[grade ?? 'High School'].forEach(add);
  return out.slice(0, max);
}

/** Short code for a subject: its preset code, or the first letters of the name. */
export function codeFor(subject: string, grade?: GradeLevel) {
  const s = subject.trim();
  const preset = Object.values(COMMON).flat().find((p) => p.subject.toLowerCase() === s.toLowerCase());
  if (preset?.code) return preset.code;
  const words = s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(and|of|the|at|in|sa|ng)$/i.test(w));
  return (words.length > 1 ? words.map((w) => w[0]).join('') : s.slice(0, 5)).toUpperCase().slice(0, 6) || (grade ? 'CLASS' : 'SUBJ');
}

/**
 * The few exam types shown as chips, per grade level. College uses terms (prelim, midterm,
 * semi-finals, finals); basic education uses quarterly exams. Anything else: the "Custom" chip.
 */
export function examKinds(grade: GradeLevel | undefined) {
  return grade === 'College' ? ['Prelim', 'Midterm', 'Semi-finals', 'Finals', 'Quiz'] : ['Quarterly exam', 'Long test', 'Quiz'];
}
