import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { ReviewerRow } from '@/components/ReviewerRow';
import { SubjectEditor, type SubjectDraft } from '@/components/SubjectEditor';
import { Grid, Header, Progress, Screen, Scroll, Section, T, Tile } from '@/components/ui';
import { confirmAction, notify } from '@/lib/confirm';
import { useUid } from '@/lib/auth-context';
import { createFolder, deleteFolder, updateFolder, useFolders, useReviewers } from '@/lib/db';
import { plural } from '@/lib/format';
import type { Folder } from '@/lib/types';
import { C, shadow } from '@/theme';

export default function Library() {
  const uid = useUid();
  const { data: folders } = useFolders(uid);
  const { data: reviewers } = useReviewers(uid);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Folder | null>(null);

  const openEditor = (f: Folder | null) => {
    setEditing(f);
    setOpen(true);
  };

  const save = async (d: SubjectDraft) => {
    try {
      if (editing) await updateFolder(uid, editing.id, d);
      else await createFolder(uid, d.name, d.icon, d.tint);
      setOpen(false);
    } catch {
      notify('Could not save the subject', 'Check your internet connection and try again.');
    }
  };

  const confirmDelete = (f: Folder) =>
    confirmAction(`Delete "${f.name}"?`, 'The lessons inside are kept and moved to "No subject yet".', 'Delete subject', async () => {
      setOpen(false);
      await deleteFolder(uid, f.id);
    });

  const loose = reviewers.filter((r) => !r.folderId || !folders.some((f) => f.id === r.folderId));

  return (
    <Screen>
      <Header title="Subjects" back={false} sub={`${plural(folders.length, 'subject')} · ${plural(reviewers.length, 'lesson')}`} />
      <Scroll>
        <Grid columns={2} gap={12}>
          {[
            ...folders.map((f) => {
              const inside = reviewers.filter((r) => r.folderId === f.id);
              const done = inside.filter((r) => r.bestPercent !== null).length;
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open subject ${f.name}`}
                  accessibilityHint="Long-press to edit or delete"
                  onPress={() => router.push({ pathname: '/folder/[id]', params: { id: f.id } })}
                  onLongPress={() => openEditor(f)}
                  style={({ pressed }) => ({ minHeight: 150, backgroundColor: C.surface, borderRadius: 20, padding: 14, gap: 4, opacity: pressed ? 0.85 : 1, ...shadow })}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Tile icon={f.icon as IconName} tint={f.tint} />
                    {/* Edit/delete button: easier to find than a long-press. */}
                    <Pressable accessibilityRole="button" accessibilityLabel={`Edit or delete ${f.name}`} hitSlop={8} onPress={() => openEditor(f)}
                      style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="more" size={20} color={C.muted} />
                    </Pressable>
                  </View>
                  <T w={900} size={17} numberOfLines={1}>{f.name}</T>
                  <T w={600} size={13.5} color={C.muted}>{plural(inside.length, 'reviewer')}</T>
                  <Progress value={inside.length ? (done / inside.length) * 100 : 0} height={6} style={{ flex: 0, marginTop: 8 }} />
                </Pressable>
              );
            }),
            <Pressable key="new" accessibilityRole="button" accessibilityLabel="New subject" onPress={() => openEditor(null)}
              style={{ minHeight: 150, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="plus" color={C.muted} />
              <T w={800} color={C.muted}>New subject</T>
            </Pressable>,
          ]}
        </Grid>

        {loose.length > 0 && (
          <Section title="No subject yet">
            <View style={{ gap: 10 }}>
              {loose.map((r) => <ReviewerRow key={r.id} uid={uid} reviewer={r} />)}
            </View>
          </Section>
        )}
      </Scroll>

      <SubjectEditor visible={open} initial={editing} onClose={() => setOpen(false)} onSave={save} onDelete={editing ? () => confirmDelete(editing) : undefined} />
    </Screen>
  );
}
