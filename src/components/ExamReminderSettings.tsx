import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EXAM_REMINDER_DAY_CHOICES, EXAM_REMINDER_DEFAULTS, type ExamReminderPlan } from '@/lib/notifications';
import { fmtTime } from '@/lib/schedule';
import type { UserProfile } from '@/lib/types';
import { C } from '@/theme';

import { Icon } from './Icon';
import { TimePicker } from './TimePicker';
import { Btn, Card, Chip, Sheet, T, Toggle } from './ui';

export const planOf = (p?: UserProfile | null): ExamReminderPlan => ({
  days: p?.examReminderDays?.length ? p.examReminderDays : EXAM_REMINDER_DEFAULTS.days,
  time: p?.examReminderTime ?? EXAM_REMINDER_DEFAULTS.time,
  hourBefore: p?.examReminderHourBefore ?? EXAM_REMINDER_DEFAULTS.hourBefore,
});

const dayLabel = (d: number) => (d === 1 ? 'Night before' : d === 7 ? '1 week' : d === 14 ? '2 weeks' : `${d} days`);

/** "1 week, 3 days and the night before at 7:00 PM · 1 hour before" */
export function planSummary(plan: ExamReminderPlan) {
  const days = [...plan.days].sort((a, b) => b - a).map((d) => (d === 1 ? 'the night before' : `${dayLabel(d)} before`));
  const list = days.length > 1 ? `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}` : days[0] ?? '';
  return [list && `${list[0].toUpperCase()}${list.slice(1)} at ${fmtTime(plan.time)}`, plan.hourBefore && '1 hour before'].filter(Boolean).join(' · ') || 'No reminders picked';
}

/** Choose when exam reminders come. */
export function ExamReminderSettings({ visible, plan, onClose, onSave }: { visible: boolean; plan: ExamReminderPlan; onClose: () => void; onSave: (p: ExamReminderPlan) => Promise<unknown> | void }) {
  const [p, setP] = useState(plan);
  const [timeOpen, setTimeOpen] = useState(false);
  const [why, setWhy] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setP(plan);
  }

  const toggleDay = (d: number) => setP((x) => ({ ...x, days: x.days.includes(d) ? x.days.filter((y) => y !== d) : [...x.days, d].sort((a, b) => b - a) }));
  const isDefault = p.time === EXAM_REMINDER_DEFAULTS.time && p.hourBefore === EXAM_REMINDER_DEFAULTS.hourBefore && [...p.days].sort().join() === [...EXAM_REMINDER_DEFAULTS.days].sort().join();

  return (
    <>
      <Sheet visible={visible && !timeOpen} onClose={onClose} title="Exam reminders" footer={<Btn title="Save reminders" onPress={() => onSave(p)} />}>
        <T w={800} size={14.5} color={C.ink2}>Remind me before each exam</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EXAM_REMINDER_DAY_CHOICES.map((d) => <Chip key={d} title={dayLabel(d)} on={p.days.includes(d)} onPress={() => toggleDay(d)} style={{ minHeight: 40, paddingHorizontal: 14 }} />)}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`Reminder time ${fmtTime(p.time)}. Tap to change`} onPress={() => setTimeOpen(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, borderWidth: 2, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14 }}>
          <Icon name="clock" color={C.primary700} />
          <View style={{ flex: 1 }}>
            <T w={800}>At this time</T>
            <T w={600} size={13} color={C.muted}>For the reminders above</T>
          </View>
          <T w={900} size={16} color={C.primary700}>{fmtTime(p.time)}</T>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 }}>
          <View style={{ flex: 1 }}>
            <T w={800}>1 hour before the exam</T>
            <T w={600} size={13} color={C.muted}>A last quick look</T>
          </View>
          <Toggle label="1 hour before the exam" value={p.hourBefore} onChange={(hourBefore) => setP({ ...p, hourBefore })} />
        </View>

        <Card style={{ backgroundColor: C.amber50, borderBottomWidth: 0, gap: 6 }}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: why }} onPress={() => setWhy(!why)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="bulb" size={20} color="#B45309" />
            <T w={900} color="#78350F" style={{ flex: 1 }}>Why these times?</T>
            <Icon name={why ? 'up' : 'down'} size={18} color="#B45309" />
          </Pressable>
          {why && (
            <T size={13.5} color="#78350F">
              • Studies on spaced practice show that short reviews spread over several days help you remember more than one long cram session.{'\n'}
              • A good first review is about a week before the exam, then again a few days before.{'\n'}
              • An evening review leaves time to rest. Sleep helps your brain keep what you studied, so avoid all-nighters.
            </T>
          )}
          {!isDefault && <Btn small variant="ghost" title="Use recommended" onPress={() => setP(EXAM_REMINDER_DEFAULTS)} style={{ marginTop: 4 }} />}
        </Card>
      </Sheet>
      <TimePicker visible={timeOpen} value={p.time} title="Exam reminder time" presets={[17, 18, 19, 20]} onClose={() => setTimeOpen(false)}
        onSave={(time) => { setP({ ...p, time }); setTimeOpen(false); }} />
    </>
  );
}
