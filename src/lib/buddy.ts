import type { Mood } from '@/components/Robot';

import type { Gesture } from './ai';
import { dailyQuests, liveStreak, localDay, todayProgress } from './game';
import type { Lang } from './lang';
import { daysUntil, examDone, fmtTime, toDay } from './schedule';
import type { Attempt, ClassItem, ExamItem, UserProfile } from './types';

export type BuddyLine = { text: string; mood: Mood; gesture: Gesture };

/**
 * What METANOIA says on the Home buddy card. Lines are picked from the student's real situation
 * (classes left today, upcoming exams, streak, quests, weak topic, time of day) and rotate every few
 * seconds. English by default; Tagalog/Taglish when the student picked it in the chat.
 */
export function buddyLines(p: UserProfile, classes: ClassItem[], exams: ExamItem[], lastAttempt: Attempt | undefined, lang: Lang = 'en', now = new Date()): BuddyLine[] {
  const tl = lang === 'tl';
  const lines: BuddyLine[] = [];
  const name = p.firstName;
  const hour = now.getHours();
  const h = hour + now.getMinutes() / 60;
  const streak = liveStreak(p);
  const studiedToday = p.stats.lastStudyDay === localDay(now);
  const quests = dailyQuests(p);
  const claimable = quests.filter((q) => q.value >= q.goal && !todayProgress(p).claimed.includes(q.id)).length;

  // Only today's classes that have not started yet, within 90 minutes.
  const soon = classes
    .filter((c) => c.day === toDay(now) && c.start > h && c.start - h <= 1.5)
    .sort((a, b) => a.start - b.start)[0];
  const exam = exams.filter((e) => !examDone(e, now)).sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)[0];
  const examIn = exam ? daysUntil(exam.date, now) : null;

  if (exam && examIn !== null && examIn <= 3) {
    const when = examIn === 0 ? (tl ? 'mamaya' : 'today') : examIn === 1 ? (tl ? 'bukas' : 'tomorrow') : tl ? `sa loob ng ${examIn} araw` : `in ${examIn} days`;
    const what = `${exam.subject}${exam.title ? ` ${exam.title.toLowerCase()}` : ''}`;
    lines.push(tl
      ? { text: `May ${what} ka ${when}! Review tayo para ready ka.`, mood: 'worried', gesture: 'think' }
      : { text: `Your ${what} is ${when}! Let's review so you're ready.`, mood: 'worried', gesture: 'think' });
  }
  if (soon)
    lines.push(tl
      ? { text: `Uy ${name}! May ${soon.subject} ka at ${fmtTime(soon.start)}. Review tayo kahit 10 mins?`, mood: 'excited', gesture: 'wave' }
      : { text: `Hey ${name}! You have ${soon.subject} at ${fmtTime(soon.start)}. Want a quick 10-minute review?`, mood: 'excited', gesture: 'wave' });
  if (claimable > 0)
    lines.push(tl
      ? { text: `May ${claimable} reward ka na pwedeng i-claim! Tap the streak to see.`, mood: 'proud', gesture: 'cheer' }
      : { text: `You have ${claimable} ${claimable === 1 ? 'reward' : 'rewards'} to claim! Tap the streak to see.`, mood: 'proud', gesture: 'cheer' });
  if (!studiedToday && streak > 0)
    lines.push(tl
      ? { text: `${streak}-day streak mo! Huwag nating putulin, kahit isang stage lang today.`, mood: 'worried', gesture: 'think' }
      : { text: `You're on a ${streak}-day streak! Let's keep it going with just one stage today.`, mood: 'worried', gesture: 'think' });
  if (!studiedToday && streak === 0)
    lines.push(tl
      ? { text: `Simulan natin ang streak mo today, ${name}! Isang stage lang.`, mood: 'excited', gesture: 'wave' }
      : { text: `Let's start your streak today, ${name}! Just one stage.`, mood: 'excited', gesture: 'wave' });
  if (studiedToday)
    lines.push(tl
      ? { text: `Ang galing mo today, ${name}! Keep it up.`, mood: 'proud', gesture: 'cheer' }
      : { text: `Great job today, ${name}! Keep it up.`, mood: 'proud', gesture: 'cheer' });

  if (lastAttempt) {
    const weak = Object.entries(lastAttempt.byTopic).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0];
    if (weak && weak[1].correct < weak[1].total)
      lines.push(tl
        ? { text: `Practice natin ang ${weak[0]}? Medyo nahirapan ka doon last time.`, mood: 'happy', gesture: 'think' }
        : { text: `Want to practice ${weak[0]}? It was a bit tricky for you last time.`, mood: 'happy', gesture: 'think' });
  }
  if (hour >= 22 || hour < 5)
    lines.push(tl
      ? { text: 'Gabi na! Matulog ka na rin ha, para fresh bukas.', mood: 'sleepy', gesture: 'sleep' }
      : { text: "It's late! Get some sleep so you're fresh tomorrow.", mood: 'sleepy', gesture: 'sleep' });
  if (hour >= 5 && hour < 11)
    lines.push(tl
      ? { text: `Good morning, ${name}! Ready ka na ba sa adventure natin today?`, mood: 'happy', gesture: 'wave' }
      : { text: `Good morning, ${name}! Ready for today's adventure?`, mood: 'happy', gesture: 'wave' });

  lines.push(tl
    ? { text: 'May tanong ka sa lesson mo? Tap me, chat tayo!', mood: 'happy', gesture: 'nod' }
    : { text: 'Got a question about your lesson? Tap me and let’s chat!', mood: 'happy', gesture: 'nod' });
  return lines;
}
