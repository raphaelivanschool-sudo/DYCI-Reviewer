import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ClassEditor, type ClassDraft } from '@/components/ClassEditor';
import { Robot } from '@/components/Robot';
import { Legend, ScheduleGrid } from '@/components/ScheduleGrid';
import { Btn, Chip, Empty, Footer, Header, IconBtn, Screen, Scroll, T, Toggle } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { addClass, deleteClass, updateClass, updateProfileFields, useClasses } from '@/lib/db';
import { scheduleClassReminders } from '@/lib/notifications';
import { fmtRange, nextClass, untilLabel } from '@/lib/schedule';
import { C } from '@/theme';

const LEADS = [5, 10, 15, 30];

export default function Schedule() {
  const uid = useUid();
  const { profile } = useAuth();
  const { data: classes, loading } = useClasses(uid);
  const [editing, setEditing] = useState<ClassDraft | null>(null);
  const [open, setOpen] = useState(false);

  const on = profile?.remindersOn ?? true;
  const lead = profile?.reminderLeadMin ?? 15;

  // Keep the phone's reminders in sync with the schedule and settings.
  const syncKey = JSON.stringify([on, lead, classes.map((c) => [c.id, c.day, c.start, c.subject, c.room])]);
  useEffect(() => {
    if (!loading) scheduleClassReminders(classes, on, lead).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey, loading]);

  const next = nextClass(classes);

  const save = async (c: ClassDraft) => {
    const { id, ...data } = c;
    if (id) await updateClass(uid, id, data);
    else await addClass(uid, data);
    setOpen(false);
  };

  return (
    <Screen>
      <Header
        title="My Schedule"
        right={
          classes.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconBtn icon="download" label="Download schedule image" onPress={() => router.push('/schedule/image')} />
              <Btn small icon="camera" title="Scan" onPress={() => router.push('/schedule/scan')} />
            </View>
          ) : undefined
        }
      />

      {!loading && classes.length === 0 ? (
        <Scroll>
          <Empty icon="calendar" title="No schedule yet" text="Take a photo of your class program and METANOIA will build your weekly schedule and remind you before each class."
            action={<View style={{ gap: 8, alignSelf: 'stretch', marginTop: 8 }}><Btn icon="camera" title="Scan my schedule" onPress={() => router.push('/schedule/scan')} /><Btn variant="ghost" icon="plus" title="Add classes by hand" onPress={() => { setEditing(null); setOpen(true); }} /></View>} />
        </Scroll>
      ) : (
        <>
          {next && (
            <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: C.navy, borderRadius: 20, padding: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Robot size={42} outfit={profile?.outfit} intro="wave" />
              </View>
              <View style={{ flex: 1 }}>
                <T w={800} size={12} color="#FDE68A" style={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>Next class · {untilLabel(next)}</T>
                <T w={900} size={17} color="#fff">{next.cls.subject}</T>
                <T w={600} size={13} color="#DBEAFE">{fmtRange(next.cls)}{next.cls.room ? ` · ${next.cls.room}` : ''}</T>
              </View>
            </View>
          )}
          <Scroll pad={false} style={{ paddingHorizontal: 16 }}>
            <ScheduleGrid classes={classes} live nextId={next?.cls.id} onPressClass={(c) => { setEditing(c); setOpen(true); }} />
            <Legend classes={classes} />
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
    </Screen>
  );
}
