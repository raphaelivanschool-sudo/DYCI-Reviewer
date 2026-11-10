import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ClassEditor, type ClassDraft } from '@/components/ClassEditor';
import { ExamEditor, type ExamDraft } from '@/components/ExamEditor';
import { ExamReminderSettings, planOf, planSummary } from '@/components/ExamReminderSettings';
import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Legend, ScheduleGrid } from '@/components/ScheduleGrid';
import { Btn, Chip, Empty, Footer, Header, Screen, Scroll, T, Toggle } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { addClass, addExam, deleteClass, updateClass, updateProfileFields, useClasses, useExams } from '@/lib/db';
import { scheduleClassReminders, scheduleExamReminders } from '@/lib/notifications';
import { countdownLabel, examDone, fmtDate, fmtRange, fmtTime, nextClass, untilLabel } from '@/lib/schedule';
import type { ExamItem } from '@/lib/types';
import { C } from '@/theme';

const LEADS = [5, 10, 15, 30];

export default function Schedule() {
  const uid = useUid();
  const { profile } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { data: classes, loading } = useClasses(uid);
  const { data: exams, loading: examsLoading } = useExams(uid);
  const [tab, setTab] = useState<'classes' | 'exams'>(params.tab === 'exams' ? 'exams' : 'classes');
  const [editing, setEditing] = useState<ClassDraft | null>(null);
  const [open, setOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  // Home's "Upcoming" exam rows open this tab on Exams.
  const [lastTabParam, setLastTabParam] = useState(params.tab);
  if (params.tab !== lastTabParam) {
    setLastTabParam(params.tab);
    if (params.tab === 'exams' || params.tab === 'classes') setTab(params.tab);
  }

  const on = profile?.remindersOn ?? true;
  const lead = profile?.reminderLeadMin ?? 15;

  // Keep the phone's reminders in sync with the schedule and settings.
  const syncKey = JSON.stringify([on, lead, classes.map((c) => [c.id, c.day, c.start, c.subject, c.room])]);
  useEffect(() => {
    if (!loading) scheduleClassReminders(classes, on, lead).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, loading]);

  const examsOn = profile?.examRemindersOn ?? true;
  const plan = planOf(profile);
  const examKey = JSON.stringify([examsOn, plan, exams.map((e) => [e.id, e.date, e.start, e.subject, e.title, e.room])]);
  useEffect(() => {
    if (!examsLoading) scheduleExamReminders(exams, examsOn, plan).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examKey, examsLoading]);

  const next = nextClass(classes);
  const upcomingExams = exams.filter((e) => !examDone(e));
  const pastExams = exams.filter((e) => examDone(e)).reverse();

  const saveExam = async (e: ExamDraft) => {
    const { id: _id, ...data } = e;
    await addExam(uid, data);
    setExamOpen(false);
  };
  const newExam = () => setExamOpen(true);
  const openExam = (e: ExamItem) => router.push({ pathname: '/exam/[id]', params: { id: e.id } });

  const save = async (c: ClassDraft, days: number[]) => {
    const { id, ...data } = c;
    if (id) await updateClass(uid, id, data);
    else await Promise.all(days.map((day) => addClass(uid, { ...data, day })));
    setOpen(false);
  };

  return (
    <Screen>
      <Header
        title="My Schedule"
        back={false}
        sub={tab === 'exams'
          ? (upcomingExams.length ? `${upcomingExams.length} upcoming ${upcomingExams.length === 1 ? 'exam' : 'exams'}` : 'No upcoming exams')
          : classes.length ? `${new Set(classes.map((c) => c.subject)).size} subjects · ${on ? `reminders ${lead} min before` : 'reminders off'}` : 'No classes yet'}
        right={
          tab === 'classes' && classes.length > 0 ? (
            // With a schedule already saved, scanning means replacing it; nothing changes until "Save new schedule".
            <Btn small variant="gold" icon="calendar" title="Change" onPress={() => router.push('/schedule/scan')} style={{ minHeight: 40, paddingHorizontal: 12 }} />
          ) : undefined
        }>
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: 4 }}>
          {(['classes', 'exams'] as const).map((k) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)}
              style={{ flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: tab === k ? '#fff' : 'transparent' }}>
              <Icon name={k === 'classes' ? 'calendar' : 'file'} size={17} color={tab === k ? C.navy : '#DBEAFE'} />
              <T w={900} size={14.5} color={tab === k ? C.navy : '#DBEAFE'}>{k === 'classes' ? 'Classes' : 'Exams'}{k === 'exams' && upcomingExams.length ? ` · ${upcomingExams.length}` : ''}</T>
            </Pressable>
          ))}
        </View>
        {tab === 'classes' && next && (
          <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 18, padding: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Robot size={40} outfit={profile?.outfit} intro="wave" />
            </View>
            <View style={{ flex: 1 }}>
              <T w={800} size={12} color="#FDE68A" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Next class · {untilLabel(next)}</T>
              <T w={900} size={16} color="#fff">{next.cls.subject}</T>
              <T w={600} size={13} color="#DBEAFE">{fmtRange(next.cls)}{next.cls.room ? ` · ${next.cls.room}` : ''}</T>
            </View>
          </View>
        )}
      </Header>

      {tab === 'exams' ? (
        <>
          <Scroll>
            {!examsLoading && upcomingExams.length === 0 && (
              <Empty icon="file" title="No upcoming exams" text="Add your quizzes, long tests and periodical exams. METANOIA will remind you the night before and 1 hour before."
                action={<Btn icon="plus" title="Add an exam" style={{ alignSelf: 'stretch', marginTop: 8 }} onPress={newExam} />} />
            )}
            <View style={{ gap: 10 }}>
              {upcomingExams.map((e) => <ExamRow key={e.id} exam={e} onPress={() => openExam(e)} />)}
            </View>
            {upcomingExams.length > 0 && <Btn small variant="soft" icon="plus" title="Add an exam" style={{ marginTop: 14 }} onPress={newExam} />}
            {pastExams.length > 0 && (
              <>
                <T w={900} size={13} color={C.muted} style={{ letterSpacing: 0.6, marginTop: 22, marginBottom: 8 }}>DONE</T>
                <View style={{ gap: 8, opacity: 0.6 }}>
                  {pastExams.slice(0, 10).map((e) => <ExamRow key={e.id} exam={e} onPress={() => openExam(e)} />)}
                </View>
              </>
            )}
          </Scroll>
          <Footer>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose when exam reminders come" onPress={() => setRemindersOpen(true)} style={{ flex: 1 }}>
                <T w={800} size={16}>Exam reminders</T>
                <T w={600} size={13} color={C.muted}>{examsOn ? planSummary(plan) : 'Off: you will not get exam alerts'}</T>
                {examsOn && <T w={800} size={13} color={C.primary700}>Change times</T>}
              </Pressable>
              <Toggle label="Exam reminders" value={examsOn} onChange={(v) => updateProfileFields(uid, { examRemindersOn: v })} />
            </View>
          </Footer>
        </>
      ) : !loading && classes.length === 0 ? (
        <Scroll>
          <Empty icon="calendar" title="No schedule yet" text="Take a photo of your class program and METANOIA will build your weekly schedule and remind you before each class."
            action={<View style={{ gap: 8, alignSelf: 'stretch', marginTop: 8 }}><Btn icon="camera" title="Scan my schedule" onPress={() => router.push('/schedule/scan')} /><Btn variant="ghost" icon="plus" title="Add classes by hand" onPress={() => { setEditing(null); setOpen(true); }} /></View>} />
        </Scroll>
      ) : (
        <>
          <Scroll pad={false} style={{ paddingHorizontal: 16 }}>
            <ScheduleGrid classes={classes} live nextId={next?.cls.id} onPressClass={(c) => { setEditing(c); setOpen(true); }} />
            <Legend classes={classes} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <Btn small variant="ghost" icon="download" title="Download" style={{ flex: 1 }} onPress={() => router.push('/schedule/image')} />
              <Btn small variant="ghost" icon="share" title="Share" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/schedule/image', params: { share: '1' } })} />
            </View>
            <Btn small variant="soft" icon="plus" title="Add a class" style={{ marginTop: 14 }} onPress={() => { setEditing(null); setOpen(true); }} />
            <T size={13} color={C.muted} style={{ textAlign: 'center', marginTop: 8 }}>Tap a class to edit it.</T>
          </Scroll>
          <Footer>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
              <View style={{ flex: 1 }}>
                <T w={800} size={16}>Class reminders</T>
                <T w={600} size={13} color={C.muted}>{on ? `Notify me ${lead} min before each class` : 'Off: you will not get class alerts'}</T>
              </View>
              <Toggle label="Class reminders" value={on} onChange={(v) => updateProfileFields(uid, { remindersOn: v })} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {LEADS.map((n) => (
                <Chip key={n} title={`${n} min`} on={on && lead === n} onPress={() => updateProfileFields(uid, { reminderLeadMin: n, remindersOn: true })} style={{ flex: 1, borderRadius: 12, paddingHorizontal: 4 }} />
              ))}
            </View>
          </Footer>
        </>
      )}

      <ClassEditor
        visible={open}
        initial={editing}
        onClose={() => setOpen(false)}
        onSave={save}
        onDelete={editing?.id ? async () => { await deleteClass(uid, editing.id!); setOpen(false); } : undefined}
      />
      <ExamEditor visible={examOpen} initial={null} onClose={() => setExamOpen(false)} onSave={saveExam} />
      <ExamReminderSettings
        visible={remindersOpen}
        plan={plan}
        onClose={() => setRemindersOpen(false)}
        onSave={async (p) => {
          setRemindersOpen(false);
          await updateProfileFields(uid, { examRemindersOn: true, examReminderDays: p.days, examReminderTime: p.time, examReminderHourBefore: p.hourBefore });
        }}
      />
    </Screen>
  );
}

function ExamRow({ exam, onPress }: { exam: ExamItem; onPress: () => void }) {
  const label = countdownLabel(exam);
  const soon = label === 'Today' || label === 'Happening now' || label === 'Tomorrow';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${exam.subject} ${exam.title}, ${fmtDate(exam.date)}, ${label}. Tap for details.`} onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, padding: 12 }}>
      <View style={{ width: 54, borderRadius: 14, backgroundColor: exam.color, alignItems: 'center', paddingVertical: 6 }}>
        <T w={800} size={11} color="rgba(255,255,255,0.85)" style={{ textTransform: 'uppercase' }}>{fmtDate(exam.date).split(', ')[1].split(' ')[0]}</T>
        <T w={900} size={21} color="#fff" style={{ lineHeight: 25 }}>{fmtDate(exam.date).split(' ').pop()}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T w={900} size={16}>{exam.subject}</T>
        <T w={700} size={13} color={C.muted}>{exam.title ? `${exam.title} · ` : ''}{fmtDate(exam.date).split(',')[0]} {fmtTime(exam.start)}{exam.room ? ` · ${exam.room}` : ''}</T>
        {!!exam.notes && <T w={600} size={12.5} color={C.ink2} numberOfLines={1}>Review: {exam.notes}</T>}
      </View>
      <View style={{ backgroundColor: soon ? '#FEF3C7' : C.primary50, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
        <T w={900} size={12} color={soon ? '#92400E' : C.primary700}>{label}</T>
      </View>
    </Pressable>
  );
}
