import * as ImagePicker from 'expo-image-picker';
import { router, usePreventRemove } from 'expo-router';
import { ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ClassEditor, type ClassDraft } from '@/components/ClassEditor';
import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Btn, Card, Chip, Footer, Header, Pill, Screen, Scroll, T } from '@/components/ui';
import { AI_MODE, scanSchedule, type ScannedClass } from '@/lib/ai';
import { photoAttachment } from '@/lib/images';
import { useAuth, useUid } from '@/lib/auth-context';
import { replaceClasses, updateProfileFields, useClasses } from '@/lib/db';
import { confirmAction, notify } from '@/lib/confirm';
import { storage } from '@/lib/firebase';
import { scheduleClassReminders } from '@/lib/notifications';
import { DAY_SHORT, fmtTime } from '@/lib/schedule';
import { C } from '@/theme';

const LEADS = [5, 10, 15, 30];
const PAPER = ['#94A3B8', '#94A3B8', '#94A3B8', '#94A3B8', '#BFDBFE', '#DDD6FE', '#BBF7D0', '#FED7AA', '#FEF08A', '#FBCFE8', '#A5F3FC', '#E2E8F0', '#BFDBFE', '#DDD6FE', '#BBF7D0', '#FED7AA'];

/** Groups the same subject/time/room across days: "MWF 7:30–8:30". */
function summarize(list: ScannedClass[]) {
  const groups = new Map<string, { item: ScannedClass; days: number[]; idx: number[] }>();
  list.forEach((c, i) => {
    const key = `${c.subject}|${c.start}|${c.end}|${c.room}`;
    const g = groups.get(key) ?? { item: c, days: [], idx: [] };
    g.days.push(c.day);
    g.idx.push(i);
    groups.set(key, g);
  });
  return [...groups.values()];
}

export default function ScanSchedule() {
  const uid = useUid();
  const { profile } = useAuth();
  const [step, setStep] = useState<'pick' | 'reading' | 'review'>('pick');
  const [found, setFound] = useState<ScannedClass[]>([]);
  const [lead, setLead] = useState(profile?.reminderLeadMin ?? 15);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasSchedule = useClasses(uid).data.length > 0;
  const title = hasSchedule ? 'Change schedule' : 'Auto Schedule';

  useEffect(() => {
    if (saved) router.replace('/schedule/image');
  }, [saved]);

  // Leaving the review step without saving keeps the current schedule; ask first so nothing is lost by accident.
  usePreventRemove(step === 'review' && found.length > 0 && !saved, ({ repeat }) =>
    confirmAction(
      'Discard the new schedule?',
      hasSchedule ? 'You haven’t saved yet. Your current schedule stays the same if you leave now.' : 'You haven’t saved these classes yet.',
      'Discard changes',
      repeat,
    ),
  );

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Permission needed', `Allow ${camera ? 'camera' : 'photo'} access in Settings to scan your schedule.`);
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled) return;
    setStep('reading');
    try {
      let path: string | null = null;
      if (AI_MODE === 'functions') {
        path = `users/${uid}/uploads/schedule-${Date.now()}.jpg`;
        await uploadBytes(ref(storage, path), await (await fetch(res.assets[0].uri)).blob(), { contentType: 'image/jpeg' });
      }
      const asset = res.assets[0];
      const attachment = AI_MODE === 'gemini' ? await photoAttachment(asset.uri, asset.width) : undefined;
      const classes = await scanSchedule({ storagePath: path, attachment });
      if (!classes.length) throw new Error('No classes were found. Try a clearer photo, or add your classes by hand.');
      setFound(classes);
      setStep('review');
    } catch (e) {
      setStep('pick');
      notify('Could not read the photo', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const classes = found.map(({ needsCheck: _n, ...c }) => c);
      await replaceClasses(uid, classes);
      setSaved(true);
      await updateProfileFields(uid, { remindersOn: true, reminderLeadMin: lead });
      await scheduleClassReminders(classes.map((c, i) => ({ ...c, id: String(i) })), true, lead).catch(() => {});
      // Navigation happens in the effect below, after the guard has been switched off.
    } catch {
      setSaving(false);
      notify('Could not save', 'Check your internet connection and try again.');
    }
  };

  const onEditorSave = (c: ClassDraft, days: number[]) => {
    const { id: _id, ...data } = c;
    setFound((list) => (editIdx === null ? [...list, ...days.map((day) => ({ ...data, day }))] : list.map((x, i) => (i === editIdx ? data : x))));
    setEditorOpen(false);
  };

  if (step === 'reading')
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 }}>
          <Robot size={130} outfit={profile?.outfit} intro="think" idleGesture="think" idleEvery={2600} />
          <T w={900} size={22}>Reading your schedule…</T>
          <T color={C.muted} style={{ textAlign: 'center' }}>{AI_MODE === 'mock' ? 'Practice mode: you will get a sample Grade 10 schedule to edit.' : 'Finding subjects, days and times.'}</T>
        </View>
      </Screen>
    );

  if (step === 'pick')
    return (
      <Screen>
        <Header title={title} sub="Step 1 of 2 · Send a photo" />
        <Scroll>
          <T w={900} size={24} style={{ lineHeight: 31 }}>Send a photo of your class schedule</T>
          <T color={C.muted} style={{ marginTop: 4, marginBottom: 16 }}>METANOIA will read it and make your schedule automatically. You will get a reminder before every class.</T>
          <View style={{ borderWidth: 3, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: C.primary50, borderRadius: 24, padding: 22, alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <View style={{ width: 200, backgroundColor: '#fff', borderRadius: 10, padding: 10, gap: 6, transform: [{ rotate: '-3deg' }] }} accessible={false}>
              <T w={900} size={10} style={{ textAlign: 'center', letterSpacing: 1 }}>CLASS PROGRAM</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
                {PAPER.map((c, i) => <View key={i} style={{ width: '23%', height: 12, borderRadius: 3, backgroundColor: c }} />)}
              </View>
            </View>
            <T w={700} size={14} color={C.navy} style={{ textAlign: 'center' }}>Printed, handwritten, or a screenshot are all OK</T>
          </View>
          <View style={{ gap: 10 }}>
            <Btn icon="camera" title="Take a photo" onPress={() => pick(true)} />
            <Btn icon="image" variant="ghost" title="Choose from gallery" onPress={() => pick(false)} />
          </View>
          <Card style={{ marginTop: 16, backgroundColor: C.amber50 }}>
            <T w={800} color="#78350F">Tips for a clear photo</T>
            <T size={14} style={{ marginTop: 4 }}>• Show the whole schedule, all days and times{'\n'}• Use good lighting, no shadows{'\n'}• Hold the phone straight above the paper</T>
          </Card>
        </Scroll>
      </Screen>
    );

  const groups = summarize(found);
  return (
    <Screen>
      <Header title={title} sub="Step 2 of 2 · Check the classes" />
      <Scroll>
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.success50 }}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Robot size={44} outfit={profile?.outfit} intro="cheer" />
          </View>
          <View style={{ flex: 1 }}>
            <T w={900} size={17} color="#14532D">I found {new Set(found.map((f) => f.subject)).size} subjects!</T>
            <T size={14}>Check if everything is correct. Tap a class to fix it.</T>
          </View>
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
          {groups.map((g) => (
            <Pressable key={g.idx.join('-')} accessibilityRole="button" accessibilityLabel={`Edit ${g.item.subject}`} onPress={() => { setEditIdx(g.idx[0]); setEditorOpen(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <View style={{ width: 10, height: 38, borderRadius: 99, backgroundColor: g.item.color }} />
              <View style={{ flex: 1 }}>
                <T w={800}>{g.item.subject}</T>
                <T w={600} size={13} color={C.muted}>{g.days.map((d) => DAY_SHORT[d]).join(' ')} · {fmtTime(g.item.start)}–{fmtTime(g.item.end)}{g.item.room ? ` · ${g.item.room}` : ''}</T>
              </View>
              {g.item.needsCheck && <Pill tone="amber" text="Check" />}
              <Icon name="edit" size={18} color={C.muted} />
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => { setEditIdx(null); setEditorOpen(true); }} style={{ minHeight: 52, alignItems: 'center', justifyContent: 'center' }}>
            <T w={800} color={C.primary700}>+ Add a class manually</T>
          </Pressable>
        </Card>

        <Card style={{ marginTop: 14, gap: 10 }}>
          <T w={800} size={16}>Remind me before class</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {LEADS.map((n) => <Chip key={n} title={`${n} min`} on={lead === n} onPress={() => setLead(n)} style={{ flex: 1, borderRadius: 12, paddingHorizontal: 4 }} />)}
          </View>
        </Card>
      </Scroll>
      <Footer row>
        <Btn title="Retake" variant="ghost" style={{ flex: 1 }} onPress={() => setStep('pick')} />
        <Btn title={hasSchedule ? 'Save new schedule' : 'Generate schedule'} style={{ flex: 1.6 }} onPress={save} loading={saving} disabled={!found.length} />
      </Footer>

      <ClassEditor
        visible={editorOpen}
        initial={editIdx === null ? null : found[editIdx]}
        onClose={() => setEditorOpen(false)}
        onSave={onEditorSave}
        onDelete={editIdx === null ? undefined : () => { setFound((l) => l.filter((_, i) => i !== editIdx)); setEditorOpen(false); }}
      />
    </Screen>
  );
}
