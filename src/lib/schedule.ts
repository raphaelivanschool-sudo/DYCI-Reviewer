import type { ClassItem, ExamItem } from './types';

export const DAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LONG = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** JS Date.getDay() (0 = Sunday) → our day (1 = Monday … 7 = Sunday). */
export const toDay = (d: Date) => ((d.getDay() + 6) % 7) + 1;

export function fmtTime(t: number, compact = false) {
  const h = Math.floor(t);
  const m = Math.round((t - h) * 60);
  const h12 = ((h + 11) % 12) + 1;
  const ap = h < 12 ? 'AM' : 'PM';
  return compact ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export const fmtRange = (c: Pick<ClassItem, 'start' | 'end'>) => `${fmtTime(c.start)} – ${fmtTime(c.end)}`;

/** Next class that has not ended yet, looking up to 7 days ahead. */
export function nextClass(classes: ClassItem[], now = new Date()) {
  if (!classes.length) return null;
  const today = toDay(now);
  const nowH = now.getHours() + now.getMinutes() / 60;
  for (let offset = 0; offset < 8; offset++) {
    const day = ((today - 1 + offset) % 7) + 1;
    const list = classes.filter((c) => c.day === day && (offset > 0 || c.end > nowH)).sort((a, b) => a.start - b.start);
    if (list.length) {
      const c = list[0];
      const minutes = Math.round((offset * 24 + c.start - nowH) * 60);
      return { cls: c, minutesUntil: minutes, ongoing: offset === 0 && c.start <= nowH };
    }
  }
  return null;
}

export function untilLabel(n: NonNullable<ReturnType<typeof nextClass>>) {
  if (n.ongoing) return 'Happening now';
  const m = n.minutesUntil;
  if (m < 60) return `In ${m} min`;
  if (m < 24 * 60) return `In ${Math.floor(m / 60)} hr ${m % 60 ? `${m % 60} min` : ''}`.trim();
  return DAY_LONG[n.cls.day];
}

/** Display range of the grid: whole hours that cover every class, at least 7 AM – 5 PM. */
export function gridHours(classes: Pick<ClassItem, 'start' | 'end'>[]) {
  const start = Math.min(7, ...classes.map((c) => Math.floor(c.start)));
  const end = Math.max(17, ...classes.map((c) => Math.ceil(c.end)));
  return { start, end };
}

/** Days shown in the grid: Mon–Fri always, Sat/Sun only when used. */
export function gridDays(classes: Pick<ClassItem, 'day'>[]) {
  const days = [1, 2, 3, 4, 5];
  if (classes.some((c) => c.day === 6)) days.push(6);
  if (classes.some((c) => c.day === 7)) days.push(7);
  return days;
}

/** Parses "1:30 PM", "13:30" or "1pm" to hours. Returns null when invalid. */
export function parseTime(input: string): number | null {
  const m = input.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (min > 59 || h > 23) return null;
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h + min / 60;
}

// ------------------------------------------------------------------ exams + upcoming

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local date → "YYYY-MM-DD". */
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "YYYY-MM-DD" → local Date at midnight. */
export function parseDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from today to the exam date (0 = today, 1 = tomorrow, negative = past). */
export const daysUntil = (key: string, now = new Date()) =>
  Math.round((parseDateKey(key).getTime() - parseDateKey(dateKey(now)).getTime()) / 86_400_000);

/** "Mon, Nov 9" */
export function fmtDate(key: string) {
  const d = parseDateKey(key);
  return `${DAY_SHORT[toDay(d)]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** An exam is over once its end time has passed. */
export function examDone(e: Pick<ExamItem, 'date' | 'end'>, now = new Date()) {
  const n = daysUntil(e.date, now);
  return n < 0 || (n === 0 && e.end <= now.getHours() + now.getMinutes() / 60);
}

export function countdownLabel(e: Pick<ExamItem, 'date' | 'start' | 'end'>, now = new Date()) {
  const n = daysUntil(e.date, now);
  const h = now.getHours() + now.getMinutes() / 60;
  if (n < 0 || (n === 0 && e.end <= h)) return 'Done';
  if (n === 0) return e.start <= h ? 'Happening now' : 'Today';
  if (n === 1) return 'Tomorrow';
  return `In ${n} days`;
}

export type UpcomingItem =
  | { kind: 'class'; id: string; key: string; title: string; sub: string; color: string; when: string; now: boolean }
  | { kind: 'exam'; id: string; key: string; title: string; sub: string; color: string; when: string; now: boolean; days: number };

/**
 * What Home shows under "Upcoming": today's classes that have not ended yet, then every exam that is
 * not over. Classes that already ended disappear; tomorrow's classes are not shown.
 */
export function upcomingItems(classes: ClassItem[], exams: ExamItem[], now = new Date()): UpcomingItem[] {
  const h = now.getHours() + now.getMinutes() / 60;
  const today = toDay(now);
  const cls: UpcomingItem[] = classes
    .filter((c) => c.day === today && c.end > h)
    .sort((a, b) => a.start - b.start)
    .map((c) => {
      const live = c.start <= h;
      const mins = Math.round((c.start - h) * 60);
      return {
        kind: 'class',
        id: c.id,
        key: `c-${c.id}`,
        title: c.subject,
        sub: `${fmtRange(c)}${c.room ? ` · ${c.room}` : ''}`,
        color: c.color,
        when: live ? 'Now' : mins < 60 ? `In ${mins} min` : fmtTime(c.start),
        now: live,
      };
    });
  const ex: UpcomingItem[] = exams
    .filter((e) => !examDone(e, now))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
    .map((e) => ({
      kind: 'exam',
      id: e.id,
      key: `e-${e.id}`,
      title: `${e.subject}${e.title ? ` · ${e.title}` : ''}`,
      sub: `${fmtDate(e.date)} · ${fmtTime(e.start)}${e.room ? ` · ${e.room}` : ''}`,
      color: e.color,
      when: countdownLabel(e, now),
      now: daysUntil(e.date, now) === 0 && e.start <= h,
      days: daysUntil(e.date, now),
    }));
  return [...cls, ...ex];
}
