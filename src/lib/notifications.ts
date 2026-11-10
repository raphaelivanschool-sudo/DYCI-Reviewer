import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { DAY_SHORT, fmtTime, parseDateKey } from './schedule';
import type { ClassItem, ExamItem } from './types';

// Class reminders and the daily study reminder are LOCAL notifications: the phone schedules them
// itself, so they work offline and need no server or Firebase Cloud Messaging.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL = 'reminders';

/**
 * Expo Go on Android does not include the notification channel module, so creating the
 * "reminders" channel fails there. In Expo Go we skip it and use the default channel;
 * a development build or APK gets the real channel.
 */
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
let channelReady = false;

async function ensureChannel() {
  if (Platform.OS !== 'android' || IN_EXPO_GO || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Class and study reminders',
      // eslint-disable-next-line import/namespace -- exported at runtime; the rule misreads the compiled enum
      importance: Notifications.AndroidImportance.HIGH,
    });
    channelReady = true;
  } catch {
    // Older or limited runtimes: fall back to the default channel.
  }
}

/** Android channel for a trigger, or nothing when the channel could not be made. */
const channel = () => (channelReady ? { channelId: CHANNEL } : {});

export async function ensurePermission() {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

async function cancelKind(kind: 'class' | 'daily' | 'exam') {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.content.data?.kind === kind).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/** Re-creates one weekly reminder per class, `leadMin` minutes before it starts. */
export async function scheduleClassReminders(classes: ClassItem[], on: boolean, leadMin: number) {
  if (Platform.OS === 'web') return;
  await cancelKind('class');
  if (!on || !classes.length || !(await ensurePermission())) return;
  for (const c of classes) {
    let day = c.day;
    let minutes = Math.round(c.start * 60) - leadMin;
    if (minutes < 0) {
      minutes += 24 * 60;
      day = day === 1 ? 7 : day - 1;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${c.subject} in ${leadMin} min`,
        body: `${DAY_SHORT[c.day]} ${fmtTime(c.start)}${c.room ? ` · ${c.room}` : ''}`,
        data: { kind: 'class', classId: c.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        ...channel(),
        weekday: (day % 7) + 1, // expo-notifications: 1 = Sunday … 7 = Saturday
        hour: Math.floor(minutes / 60),
        minute: minutes % 60,
      },
    });
  }
}

/** time: hours of the day (19.5 = 7:30 PM). */
export async function scheduleDailyStudyReminder(on: boolean, time = 19) {
  if (Platform.OS === 'web') return;
  await cancelKind('daily');
  if (!on || !(await ensurePermission())) return;
  const hour = Math.floor(time);
  const minute = Math.round((time - hour) * 60);
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Time to review!', body: 'METANOIA is ready. Even 10 minutes keeps your streak going.', data: { kind: 'daily' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...channel(), hour, minute },
  });
}

/**
 * Exam reminder plan. Defaults follow spaced-practice research: several short reviews spread over
 * the days before a test help students remember more than one long session the night before, and the
 * best first review gap is roughly 10–20% of the time left (about a week before a typical exam).
 * The evening reminder leaves time to review and still sleep well, since sleep helps memory.
 */
export const EXAM_REMINDER_DEFAULTS = { days: [7, 3, 1], time: 19, hourBefore: true };
export const EXAM_REMINDER_DAY_CHOICES = [14, 7, 5, 3, 2, 1];

export type ExamReminderPlan = { days: number[]; time: number; hourBefore: boolean };

const examLine = (days: number, name: string) =>
  days === 1
    ? { title: `Exam tomorrow: ${name}`, body: 'Do a light review and a quick quiz tonight, then sleep early. You’ve got this!' }
    : days >= 7
      ? { title: `${name} in ${days === 7 ? '1 week' : `${days} days`}`, body: 'Start now with a short review. A little every day beats cramming.' }
      : { title: `${name} in ${days} days`, body: 'Quiz yourself with METANOIA and focus on your weak topics.' };

/** One-time reminders per upcoming exam: N days before at the chosen time, plus 1 hour before it starts. */
export async function scheduleExamReminders(exams: ExamItem[], on: boolean, plan: ExamReminderPlan = EXAM_REMINDER_DEFAULTS) {
  if (Platform.OS === 'web') return;
  await cancelKind('exam');
  const now = Date.now();
  const future = exams.filter((e) => parseDateKey(e.date).getTime() + e.start * 3_600_000 > now);
  if (!on || !future.length || !(await ensurePermission())) return;
  for (const e of future) {
    const day = parseDateKey(e.date);
    const name = `${e.subject}${e.title ? ` ${e.title}` : ''}`;
    const alerts = plan.days.map((d) => {
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate() - d, Math.floor(plan.time), Math.round((plan.time % 1) * 60));
      return { at: at.getTime(), ...examLine(d, name) };
    });
    if (plan.hourBefore)
      alerts.push({ at: day.getTime() + (e.start - 1) * 3_600_000, title: `${name} in 1 hour`, body: `${fmtTime(e.start)}${e.room ? ` · ${e.room}` : ''}. Breathe, you’re ready!` });
    for (const a of alerts) {
      if (a.at <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: a.title, body: a.body, data: { kind: 'exam', examId: e.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, ...channel(), date: new Date(a.at) },
      });
    }
  }
}
