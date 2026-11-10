import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AI_READS_FILES, readAsBase64, scanExamNotice, type Attachment } from '@/lib/ai';
import { useAuth, useUid } from '@/lib/auth-context';
import { notify } from '@/lib/confirm';
import { useFolders, useReviewers } from '@/lib/db';
import { photoAttachment } from '@/lib/images';
import { dateKey, fmtDate, fmtTime, MONTH_SHORT, parseDateKey, parseTime } from '@/lib/schedule';
import { examKinds } from '@/lib/subjects';
import type { ExamItem } from '@/lib/types';
import { C, PALETTE, tintOf } from '@/theme';

import { ColorPicker } from './ColorPicker';
import { Icon, type IconName } from './Icon';
import { Btn, Chip, Field, Sheet, T } from './ui';

export type ExamDraft = Omit<ExamItem, 'id'> & { id?: string };

const blank = (): ExamDraft => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return { subject: '', title: '', date: dateKey(d), start: 8, end: 9, room: '', notes: '', color: PALETTE[1], folderId: null };
};

/** Bottom sheet to add or edit one exam. Can fill itself in from a photo or file of the teacher's exam notice. */
export function ExamEditor({ visible, initial, onClose, onSave, onDelete }: {
  visible: boolean;
  initial: ExamDraft | null;
  onClose: () => void;
  onSave: (e: ExamDraft) => Promise<unknown> | void;
  onDelete?: () => void;
}) {
  const uid = useUid();
  const { profile } = useAuth();
  const folders = useFolders(uid).data;
  const reviewers = useReviewers(uid).data;
  const [e, setE] = useState<ExamDraft>(initial ?? blank());
  const [start, setStart] = useState(fmtTime((initial ?? e).start));
  const [end, setEnd] = useState(fmtTime((initial ?? e).end));
  const [customKind, setCustomKind] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calKey, setCalKey] = useState(0);
  const [lastInitial, setLastInitial] = useState(initial);
  const [wasVisible, setWasVisible] = useState(visible);

  const kinds = examKinds(profile?.gradeLevel);

  // Reset the form whenever the sheet opens or a different exam is opened.
  if (initial !== lastInitial || visible !== wasVisible) {
    const next = initial ?? blank();
    setLastInitial(initial);
    setWasVisible(visible);
    setE(next);
    setStart(fmtTime(next.start));
    setEnd(fmtTime(next.end));
    setCustomKind(!!next.title && !kinds.includes(next.title));
    setError(null);
    setScanned(false);
    setSaving(false);
    setShowColors(false);
    setCalKey((k) => k + 1);
  }

  // Quick picks: only subjects that already have reviewers, so the exam can link to them.
  const picks = folders.filter((f) => reviewers.some((r) => r.folderId === f.id)).slice(0, 6).map((f) => ({ subject: f.name, color: tintOf(f.tint).fg }));
  const setSubject = (subject: string, color?: string) => {
    const folder = folders.find((f) => f.name.trim().toLowerCase() === subject.trim().toLowerCase());
    setE((x) => ({ ...x, subject, color: color ?? x.color, folderId: folder?.id ?? null }));
  };

  /** Sends the notice to the AI and fills in only what it found. */
  const readNotice = async (get: () => Promise<Attachment[] | null>) => {
    if (!AI_READS_FILES) return notify('Needs Gemini mode', 'Practice mode can’t read photos or files. Type the details instead.');
    try {
      const files = await get();
      if (!files?.length) return;
      setScanning(true);
      setError(null);
      const found = await scanExamNotice(files);
      const today = dateKey(new Date());
      if (found.subject) setSubject(found.subject);
      setE((x) => ({
        ...x,
        title: found.title ?? x.title,
        date: found.date && found.date >= today ? found.date : x.date,
        room: found.room ?? x.room,
        notes: found.notes ? (x.notes ? `${x.notes}\n${found.notes}` : found.notes) : x.notes,
        start: found.start ?? x.start,
        end: found.end ?? (found.start !== undefined ? found.start + 1 : x.end),
      }));
      if (found.title && !kinds.includes(found.title)) setCustomKind(true);
      if (found.start !== undefined) setStart(fmtTime(found.start));
      if (found.end !== undefined || found.start !== undefined) setEnd(fmtTime(found.end ?? found.start! + 1));
      if (found.date) setCalKey((k) => k + 1);
      setScanned(true);
    } catch (err) {
      notify('Could not read the notice', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const fromPhotos = (camera: boolean) =>
    readNotice(async () => {
      const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        notify('Permission needed', `Allow ${camera ? 'camera' : 'photo'} access in Settings.`);
        return null;
      }
      const res = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 4 });
      if (res.canceled) return null;
      return Promise.all(res.assets.map((a) => photoAttachment(a.uri, a.width)));
    });

  const fromFile = () =>
    readNotice(async () => {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain', 'image/*'], copyToCacheDirectory: true });
      if (res.canceled) return null;
      const a = res.assets[0];
      const type = a.mimeType ?? 'application/pdf';
      return [type.startsWith('image/') ? await photoAttachment(a.uri) : { mimeType: type, base64: await readAsBase64(a.uri) }];
    });

  const save = async () => {
    const s = parseTime(start);
    const en = parseTime(end);
    if (!e.subject.trim()) return setError('Type the subject of the exam.');
    if (s === null || en === null) return setError('Use a time like 1:30 PM.');
    if (en <= s) return setError('The end time must be after the start time.');
    setSaving(true);
    try {
      await onSave({ ...e, subject: e.subject.trim(), title: e.title.trim(), room: e.room.trim(), notes: e.notes.trim(), start: s, end: en });
    } catch {
      setError('Could not save. Check your internet connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initial?.id ? 'Edit exam' : 'Add an exam'}
      footer={
        <>
          {error && <T w={700} color={C.danger}>{error}</T>}
          <Btn title="Save exam" onPress={save} loading={saving} />
          {onDelete && <Btn title="Remove this exam" variant="ghost" icon="trash" textColor={C.danger} onPress={onDelete} />}
        </>
      }>
      {/* Optional: let the AI read the teacher's notice. One row to keep the form short. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: C.primary50, borderRadius: 16, paddingVertical: 8, paddingLeft: 12, paddingRight: 8 }}>
        {scanning ? <ActivityIndicator color={C.primary} /> : <Icon name={scanned ? 'check' : 'sparkles'} size={20} color={scanned ? C.success : C.primary700} />}
        <View style={{ flex: 1 }}>
          <T w={900} size={14} color={C.navy}>{scanning ? 'Reading the notice…' : scanned ? 'Filled in. Check below.' : 'Fill in from exam notice'}</T>
          {!scanning && !scanned && <T w={600} size={12} color={C.muted}>Optional · photo or file</T>}
        </View>
        {!scanning && (
          <>
            <NoticeBtn icon="image" label="Photos" onPress={() => fromPhotos(false)} />
            <NoticeBtn icon="camera" label="Camera" onPress={() => fromPhotos(true)} />
            <NoticeBtn icon="file" label="File" onPress={fromFile} />
          </>
        )}
      </View>

      <Field label="Subject" value={e.subject} onChangeText={(v) => setSubject(v)} placeholder="Type any subject" maxLength={40} />
      {picks.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 }}>
          {picks.map((p) => (
            <Chip key={p.subject} icon="book" title={p.subject} on={e.subject.trim().toLowerCase() === p.subject.toLowerCase()} onPress={() => setSubject(p.subject, p.color)} style={{ minHeight: 34, paddingHorizontal: 10 }} />
          ))}
        </View>
      )}

      <T w={800} size={14.5} color={C.ink2}>Type of exam <T w={700} size={14.5} color={C.muted}>(Optional)</T></T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {kinds.map((k) => (
          <Chip key={k} title={k} on={!customKind && e.title === k} onPress={() => { setCustomKind(false); setE({ ...e, title: e.title === k ? '' : k }); }} style={{ minHeight: 34, paddingHorizontal: 10 }} />
        ))}
        <Chip title="Custom" icon="edit" on={customKind} onPress={() => { setCustomKind(true); if (kinds.includes(e.title)) setE({ ...e, title: '' }); }} style={{ minHeight: 34, paddingHorizontal: 10 }} />
      </View>
      {customKind && <Field label="Your exam type" value={e.title} onChangeText={(v) => setE({ ...e, title: v })} placeholder="e.g. Departmental exam" maxLength={40} autoFocus />}

      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T w={800} size={14.5} color={C.ink2}>Date</T>
        <T w={800} size={14} color={C.primary700}>{fmtDate(e.date)}</T>
      </View>
      <Calendar key={calKey} value={e.date} onChange={(date) => setE({ ...e, date })} />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Field label="Starts" value={start} onChangeText={setStart} placeholder="8:00 AM" /></View>
        <View style={{ flex: 1 }}><Field label="Ends" value={end} onChangeText={setEnd} placeholder="9:00 AM" /></View>
      </View>
      <Field label="Room" optional value={e.room} onChangeText={(v) => setE({ ...e, room: v })} placeholder="Rm 204" />
      <Field label="What to review" optional multiline value={e.notes} onChangeText={(v) => setE({ ...e, notes: v })} placeholder={'Chapters 3–4\nQuadratic equations'} />

      {/* Color is folded away: it is set from the subject and rarely changed. */}
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showColors }} onPress={() => setShowColors(!showColors)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 }}>
        <T w={800} size={14.5} color={C.ink2} style={{ flex: 1 }}>Color</T>
        <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: e.color }} />
        <Icon name={showColors ? 'up' : 'down'} size={18} color={C.muted} />
      </Pressable>
      {showColors && <ColorPicker label="" value={e.color} onChange={(color) => { setE({ ...e, color }); setShowColors(false); }} />}
    </Sheet>
  );
}

function NoticeBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Read exam notice from ${label}`} onPress={onPress} hitSlop={4}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 12, backgroundColor: pressed ? C.primary100 : '#fff', alignItems: 'center', justifyContent: 'center' })}>
      <Icon name={icon} size={19} color={C.primary700} />
    </Pressable>
  );
}

/** Small month calendar. Past days are disabled. */
function Calendar({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const today = dateKey(new Date());
  const sel = parseDateKey(value);
  const [month, setMonth] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1));
  const first = (month.getDay() + 6) % 7; // Monday-first grid
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const canGoBack = month > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <View style={{ borderWidth: 2, borderColor: C.line, borderRadius: 18, padding: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canGoBack} onPress={() => shift(-1)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: canGoBack ? 1 : 0.3 }}>
          <Icon name="left" size={18} color={C.ink2} />
        </Pressable>
        <T w={900} size={15} style={{ flex: 1, textAlign: 'center' }}>{MONTH_SHORT[month.getMonth()]} {month.getFullYear()}</T>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => shift(1)} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="right" size={18} color={C.ink2} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <T key={i} w={800} size={12} color={C.muted} style={{ flex: 1, textAlign: 'center' }}>{d}</T>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
        {cells.map((n, i) => {
          if (!n) return <View key={i} style={{ width: `${100 / 7}%`, height: 38 }} />;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), n));
          const on = key === value;
          const past = key < today;
          return (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel={fmtDate(key)} accessibilityState={{ selected: on, disabled: past }} disabled={past} onPress={() => onChange(key)}
              style={{ width: `${100 / 7}%`, height: 38, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.primary : 'transparent', borderWidth: key === today && !on ? 2 : 0, borderColor: C.primary }}>
                <T w={on ? 900 : 700} size={14} color={on ? '#fff' : past ? '#CBD5E1' : C.ink}>{n}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
