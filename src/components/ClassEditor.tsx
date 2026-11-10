import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { useAuth, useUid } from '@/lib/auth-context';
import { useClasses, useFolders } from '@/lib/db';
import { sheetPanel } from '@/lib/responsive';
import { DAY_SHORT, fmtTime, parseTime } from '@/lib/schedule';
import { codeFor, subjectPicks } from '@/lib/subjects';
import type { ClassItem } from '@/lib/types';
import { C, PALETTE } from '@/theme';

import { ColorPicker } from './ColorPicker';
import { Btn, Chip, Field, T } from './ui';

export type ClassDraft = Omit<ClassItem, 'id'> & { id?: string };

const EMPTY: ClassDraft = { subject: '', code: '', color: PALETTE[1], day: 1, start: 8, end: 9, room: '', teacher: '' };

/**
 * Bottom sheet to add or edit a class. When adding (initial = null) several days can be picked:
 * onSave then gets every chosen day and one class is created per day. Editing keeps one day.
 */
export function ClassEditor({ visible, initial, onClose, onSave, onDelete }: {
  visible: boolean;
  initial: ClassDraft | null;
  onClose: () => void;
  onSave: (c: ClassDraft, days: number[]) => void;
  onDelete?: () => void;
}) {
  const [c, setC] = useState<ClassDraft>(initial ?? EMPTY);
  const [start, setStart] = useState(fmtTime((initial ?? EMPTY).start));
  const [end, setEnd] = useState(fmtTime((initial ?? EMPTY).end));
  const [days, setDays] = useState<number[]>([(initial ?? EMPTY).day]);
  const [error, setError] = useState<string | null>(null);
  const [lastInitial, setLastInitial] = useState(initial);
  const [wasVisible, setWasVisible] = useState(visible);
  const multi = initial === null;
  const uid = useUid();
  const { profile } = useAuth();
  const picks = subjectPicks(profile?.gradeLevel, useClasses(uid).data, useFolders(uid).data);

  // Reset the form whenever the sheet opens or a different class is opened.
  if (initial !== lastInitial || visible !== wasVisible) {
    setLastInitial(initial);
    setWasVisible(visible);
    setC(initial ?? EMPTY);
    setStart(fmtTime((initial ?? EMPTY).start));
    setEnd(fmtTime((initial ?? EMPTY).end));
    setDays([(initial ?? EMPTY).day]);
    setError(null);
  }

  const toggleDay = (d: number) => {
    if (!multi) return setC({ ...c, day: d });
    setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d].sort((a, b) => a - b)));
  };

  const save = () => {
    const s = parseTime(start);
    const e = parseTime(end);
    if (!c.subject.trim()) return setError('Type the subject name.');
    if (s === null || e === null) return setError('Use a time like 1:30 PM.');
    if (e <= s) return setError('The end time must be after the start time.');
    if (multi && !days.length) return setError('Pick at least one day.');
    const chosen = multi ? days : [c.day];
    const preset = picks.find((p) => p.subject.toLowerCase() === c.subject.trim().toLowerCase());
    onSave({ ...c, subject: c.subject.trim(), code: c.code.trim() || preset?.code || codeFor(c.subject, profile?.gradeLevel), start: s, end: e, day: chosen[0] }, chosen);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,.45)' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[sheetPanel, { maxHeight: '88%' }]}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 34 }} keyboardShouldPersistTaps="handled">
          <View style={{ width: 40, height: 5, borderRadius: 9, backgroundColor: '#CBD5E1', alignSelf: 'center' }} />
          <T w={900} size={21}>{initial?.id || initial?.subject ? 'Edit class' : 'Add a class'}</T>

          <Field label="Subject" value={c.subject} onChangeText={(v) => setC({ ...c, subject: v, code: '' })} placeholder="Type any subject" maxLength={40} />
          <T w={700} size={12.5} color={C.muted} style={{ marginTop: -6 }}>Type it, or tap a quick pick:</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {picks.map((p) => (
              <Chip key={p.subject} title={p.subject} on={c.subject.trim().toLowerCase() === p.subject.toLowerCase()} onPress={() => setC({ ...c, subject: p.subject, code: p.code ?? '', color: p.color })} style={{ minHeight: 36, paddingHorizontal: 12 }} />
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <T w={800} size={14.5} color={C.ink2}>{multi ? 'Days' : 'Day'}</T>
            {multi && <T w={700} size={12.5} color={C.muted}>Pick all the days this class meets</T>}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <Chip key={d} title={DAY_SHORT[d]} on={multi ? days.includes(d) : c.day === d} onPress={() => toggleDay(d)} style={{ flex: 1, paddingHorizontal: 0, minHeight: 40 }} />
            ))}
          </View>
          {multi && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip title="Mon–Fri" on={days.join() === '1,2,3,4,5'} onPress={() => setDays([1, 2, 3, 4, 5])} style={{ minHeight: 34, paddingHorizontal: 12 }} />
              <Chip title="MWF" on={days.join() === '1,3,5'} onPress={() => setDays([1, 3, 5])} style={{ minHeight: 34, paddingHorizontal: 12 }} />
              <Chip title="TTh" on={days.join() === '2,4'} onPress={() => setDays([2, 4])} style={{ minHeight: 34, paddingHorizontal: 12 }} />
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Starts" value={start} onChangeText={setStart} placeholder="1:00 PM" /></View>
            <View style={{ flex: 1 }}><Field label="Ends" value={end} onChangeText={setEnd} placeholder="2:00 PM" /></View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Room" optional value={c.room} onChangeText={(v) => setC({ ...c, room: v })} placeholder="Rm 204" /></View>
            <View style={{ flex: 1 }}><Field label="Teacher" optional value={c.teacher} onChangeText={(v) => setC({ ...c, teacher: v })} placeholder="Mr. Garcia" /></View>
          </View>

          <ColorPicker value={c.color} onChange={(color) => setC({ ...c, color })} />

          {error && <T w={700} color={C.danger}>{error}</T>}
          <Btn title={multi && days.length > 1 ? `Save class · ${days.length} days` : 'Save class'} onPress={save} />
          {onDelete && <Btn title="Remove this class" variant="ghost" icon="trash" textColor={C.danger} onPress={onDelete} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
