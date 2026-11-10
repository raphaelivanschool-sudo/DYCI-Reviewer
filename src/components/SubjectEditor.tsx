import { useState } from 'react';
import { Pressable, View } from 'react-native';

import type { Folder } from '@/lib/types';
import { C, PALETTE, tintOf } from '@/theme';

import { ColorPicker } from './ColorPicker';
import { FOLDER_ICONS, Icon, type IconName } from './Icon';
import { Btn, Field, Grid, Sheet, T } from './ui';

export type SubjectDraft = { name: string; icon: string; tint: string };

/** Bottom sheet to create or edit a subject: name, icon and color, with a live preview. */
export function SubjectEditor({ visible, initial, onClose, onSave, onDelete }: {
  visible: boolean;
  /** null = new subject. */
  initial: Folder | null;
  onClose: () => void;
  onSave: (d: SubjectDraft) => Promise<unknown> | void;
  onDelete?: () => void;
}) {
  const blank: SubjectDraft = { name: '', icon: 'book', tint: PALETTE[1] };
  const [d, setD] = useState<SubjectDraft>(initial ?? blank);
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState('');

  // Reset the form each time the sheet opens.
  const key = `${visible}:${initial?.id ?? 'new'}`;
  if (key !== lastKey) {
    setLastKey(key);
    setD(initial ? { name: initial.name, icon: initial.icon, tint: tintOf(initial.tint).fg } : blank);
    setBusy(false);
  }

  const t = tintOf(d.tint);
  const save = async () => {
    if (!d.name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave({ ...d, name: d.name.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initial ? 'Edit subject' : 'New subject'}
      footer={
        <>
          <Btn title={initial ? 'Save changes' : 'Create subject'} onPress={save} loading={busy} disabled={!d.name.trim()} />
          {onDelete && <Btn title="Delete subject" variant="ghost" icon="trash" textColor={C.danger} onPress={onDelete} />}
        </>
      }>
      {/* Preview of the subject card */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: t.bg }}>
        <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: t.fg, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={d.icon as IconName} color="#fff" size={24} />
        </View>
        <T w={900} size={17} color={t.fg} numberOfLines={1} style={{ flex: 1 }}>{d.name.trim() || 'Subject name'}</T>
      </View>

      <Field label="Subject name" value={d.name} onChangeText={(name) => setD({ ...d, name })} placeholder="e.g. Science" maxLength={40} onSubmitEditing={save} returnKeyType="done" />

      <T w={800} size={14.5} color={C.ink2}>Icon</T>
      <Grid columns={8} gap={8}>
        {FOLDER_ICONS.map((i) => {
          const on = d.icon === i;
          return (
            <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Icon ${i}`} accessibilityState={{ selected: on }} onPress={() => setD({ ...d, icon: i })}
              style={{ aspectRatio: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.fg : t.bg }}>
              <Icon name={i} size={20} color={on ? '#fff' : t.fg} />
            </Pressable>
          );
        })}
      </Grid>

      <ColorPicker value={d.tint} onChange={(tint) => setD({ ...d, tint })} />
    </Sheet>
  );
}
