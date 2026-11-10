import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ExamEditor, type ExamDraft } from '@/components/ExamEditor';
import { Icon, type IconName } from '@/components/Icon';
import { ReviewerRow } from '@/components/ReviewerRow';
import { Robot } from '@/components/Robot';
import { Btn, Card, Empty, Header, IconBtn, Loading, Screen, Scroll, Section, T } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { confirmAction, notify } from '@/lib/confirm';
import { createFolder, deleteExam, updateExam, useExams, useFolders, useReviewers } from '@/lib/db';
import { countdownLabel, daysUntil, examDone, fmtDate, fmtTime } from '@/lib/schedule';
import { C } from '@/theme';

/** One exam: when and where, what to review, and the student's reviewers for that subject. */
export default function ExamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const { profile } = useAuth();
  const { data: exams, loading } = useExams(uid);
  const folders = useFolders(uid).data;
  const allReviewers = useReviewers(uid).data;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const exam = exams.find((e) => e.id === id);

  if (loading) return <Loading />;
  if (!exam)
    return (
      <Screen>
        <Header title="Exam" />
        <Scroll><Empty icon="file" title="Exam not found" text="It may have been removed." /></Scroll>
      </Screen>
    );

  // The exam's subject: the one picked when it was saved, or a subject with the same name.
  const folder = folders.find((f) => f.id === exam.folderId) ?? folders.find((f) => f.name.trim().toLowerCase() === exam.subject.trim().toLowerCase());
  const reviewers = folder ? allReviewers.filter((r) => r.folderId === folder.id) : [];
  // Suggest the reviewer that needs work most: never played, then lowest best score.
  const next = [...reviewers].sort((a, b) => (a.bestPercent ?? -1) - (b.bestPercent ?? -1))[0];
  const done = examDone(exam);
  const days = daysUntil(exam.date);
  const name = `${exam.subject}${exam.title ? ` ${exam.title}` : ''}`;

  const save = async (e: ExamDraft) => {
    const { id: _id, ...data } = e;
    await updateExam(uid, exam.id, data);
    setEditing(false);
  };

  const remove = () =>
    confirmAction(`Remove "${name}"?`, 'Its reminders will be removed too.', 'Remove', async () => {
      setEditing(false);
      await deleteExam(uid, exam.id);
      router.back();
    });

  /** Opens "New reviewer" saved in this exam's subject, creating the subject first if needed. */
  const makeReviewer = async () => {
    setBusy(true);
    try {
      let folderId = folder?.id;
      if (!folderId) {
        folderId = (await createFolder(uid, exam.subject, 'book', exam.color)).id;
        await updateExam(uid, exam.id, { folderId });
      }
      router.push({ pathname: '/add-reviewer', params: { folderId, title: `${name} reviewer` } });
    } catch {
      notify('Could not open', 'Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const askPlan = () =>
    router.push({
      pathname: '/chat',
      params: {
        ask: `Help me make a simple study plan for my ${name} on ${fmtDate(exam.date)} (${days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}).` +
          (exam.notes ? ` It covers: ${exam.notes.replace(/\s*\n\s*/g, '; ')}` : ''),
      },
    });

  return (
    <Screen>
      <Header title={exam.subject} kicker={exam.title || 'Exam'} sub={`${fmtDate(exam.date)} · ${fmtTime(exam.start)} – ${fmtTime(exam.end)}`} color={exam.color}
        right={<IconBtn icon="edit" label="Edit exam" onPress={() => setEditing(true)} />}>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 12 }}>
          <Chip icon="clock" text={countdownLabel(exam)} gold={!done && days <= 1} />
          {exam.room ? <Chip icon="home" text={exam.room} /> : null}
        </View>
      </Header>
      <Scroll>
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="target" size={20} color={C.primary700} />
            <T w={900} size={16} style={{ flex: 1 }}>What to review</T>
            <T w={800} size={14} color={C.primary700} onPress={() => setEditing(true)}>{exam.notes ? 'Edit' : 'Add'}</T>
          </View>
          {exam.notes ? (
            <T w={600} size={15} color={C.ink2}>{exam.notes}</T>
          ) : (
            <T w={600} size={14} color={C.muted}>Nothing yet. Add the topics, or tap Edit and send a photo of your teacher’s exam notice.</T>
          )}
        </Card>

        {!done && (
          <Card style={{ marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#EEF4FF', borderBottomWidth: 0 }}>
            <Robot size={48} still outfit={profile?.outfit} mood={days <= 1 ? 'excited' : 'happy'} />
            <T w={700} size={13.5} color={C.ink2} style={{ flex: 1 }}>
              <T w={900} size={13.5} color={C.navy}>METANOIA says: </T>
              {days <= 0
                ? 'Quick look at your notes, breathe, and do your best!'
                : days === 1
                  ? 'Do a light review and a short quiz tonight, then sleep early.'
                  : reviewers.length
                    ? `Play one stage a day until the exam. Short daily reviews beat cramming.`
                    : `Make a reviewer now so you can practice a little every day.`}
            </T>
          </Card>
        )}

        <Section title={folder ? `Your ${folder.name} reviewers` : 'Your reviewers'}>
          {reviewers.length ? (
            <View style={{ gap: 10 }}>
              {next && !done && (
                <Btn icon="play" variant="gold" title={next.bestPercent === null ? `Start: ${next.title}` : `Practice: ${next.title}`}
                  onPress={() => router.push({ pathname: '/briefing/[id]', params: { id: next.id } })} />
              )}
              {reviewers.map((r) => <ReviewerRow key={r.id} uid={uid} reviewer={r} folder={folder} />)}
              <Btn small variant="soft" icon="plus" title="Add another reviewer" onPress={makeReviewer} loading={busy} />
            </View>
          ) : (
            <Empty
              icon="sparkles"
              title={`No ${exam.subject} reviewer yet`}
              text="Make one from your notes, book pages or handouts. METANOIA turns them into practice questions for this exam."
              action={
                <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
                  <Btn icon="sparkles" title="Make a reviewer" onPress={makeReviewer} loading={busy} />
                  <Btn icon="chat" variant="ghost" title="Make a study plan" onPress={askPlan} />
                </View>
              }
            />
          )}
        </Section>
        {reviewers.length > 0 && !done && <Btn small variant="ghost" icon="chat" title="Make a study plan with METANOIA" style={{ marginTop: 12 }} onPress={askPlan} />}
      </Scroll>

      <ExamEditor visible={editing} initial={exam} onClose={() => setEditing(false)} onSave={save} onDelete={remove} />
    </Screen>
  );
}

function Chip({ icon, text, gold }: { icon: IconName; text: string; gold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, height: 32, borderRadius: 99, backgroundColor: gold ? '#FBBF24' : 'rgba(255,255,255,0.18)' }}>
      <Icon name={icon} size={15} color={gold ? '#422006' : '#fff'} />
      <T w={900} size={13.5} color={gold ? '#422006' : '#fff'}>{text}</T>
    </View>
  );
}
