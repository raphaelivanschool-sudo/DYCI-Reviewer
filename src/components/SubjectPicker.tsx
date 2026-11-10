import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { notify } from '@/lib/confirm';
import { createFolder } from '@/lib/db';
import type { Folder } from '@/lib/types';
import { C, PALETTE, tintOf } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Field, Sheet, T } from './ui';

/**
 * One row that shows the chosen subject; tapping it opens a searchable list.
 * Stays short no matter how many subjects the student has, and can create a new subject on the spot.
 */
export function SubjectPicker({ uid, folders, value, onChange }: { uid: string; folders: Folder[]; value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const chosen = folders.find((f) => f.id === value) ?? null;
  const term = q.trim().toLowerCase();
  const list = term ? folders.filter((f) => f.name.toLowerCase().includes(term)) : folders;
  const exact = folders.some((f) => f.name.toLowerCase() === term);

  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQ('');
  };

  const create = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    try {
      const ref = await createFolder(uid, q.trim(), 'book', PALETTE[folders.length % PALETTE.length]);
      pick(ref.id);
    } catch {
      notify('Could not create the subject', 'Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <T w={800} size={14.5} color={C.ink2}>Save in subject</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`Subject: ${chosen?.name ?? 'No subject'}. Tap to change`} onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, borderWidth: 2, borderColor: C.line, borderRadius: 16, paddingHorizontal: 12, backgroundColor: pressed ? C.bg : C.surface })}>
        <Badge folder={chosen} />
        <T w={800} size={15.5} style={{ flex: 1 }} numberOfLines={1}>{chosen?.name ?? 'No subject'}</T>
        <T w={800} size={14} color={C.primary700}>Change</T>
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title="Save in subject">
        <Field label="Search or type a new subject" icon="folder" value={q} onChangeText={setQ} placeholder="e.g. Science" returnKeyType="done" onSubmitEditing={() => (list.length === 1 ? pick(list[0].id) : !exact && create())} />
        {term && !exact ? (
          <Row onPress={create} label={busy ? 'Creating…' : `Create “${q.trim()}”`} folder={null} icon="plus" accent />
        ) : null}
        <View style={{ borderWidth: 2, borderColor: C.line, borderRadius: 18, overflow: 'hidden' }}>
          {!term && <Row onPress={() => pick(null)} label="No subject" folder={null} on={value === null} />}
          {list.map((f) => <Row key={f.id} onPress={() => pick(f.id)} label={f.name} folder={f} on={f.id === value} />)}
          {term && !list.length ? <T w={600} color={C.muted} style={{ padding: 14 }}>No subject named “{q.trim()}” yet.</T> : null}
        </View>
      </Sheet>
    </>
  );
}

function Badge({ folder, icon }: { folder: Folder | null; icon?: IconName }) {
  const t = folder ? tintOf(folder.tint) : { bg: C.chip, fg: C.muted };
  return (
    <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: folder ? t.fg : t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon ?? ((folder?.icon as IconName) || 'folder')} size={19} color={folder ? '#fff' : t.fg} />
    </View>
  );
}

function Row({ label, folder, on, onPress, icon, accent }: { label: string; folder: Folder | null; on?: boolean; onPress: () => void; icon?: IconName; accent?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, borderBottomWidth: accent ? 0 : 1, borderBottomColor: C.line, backgroundColor: on ? C.primary50 : pressed ? C.bg : accent ? C.primary50 : C.surface, borderRadius: accent ? 16 : 0 })}>
      <Badge folder={folder} icon={icon} />
      <T w={800} size={15.5} color={accent ? C.primary700 : C.ink} style={{ flex: 1 }} numberOfLines={1}>{label}</T>
      {on && <Icon name="check" size={20} color={C.primary} strokeWidth={3} />}
    </Pressable>
  );
}
