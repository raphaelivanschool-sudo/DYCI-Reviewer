import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { SubjectPicker } from '@/components/SubjectPicker';
import { Btn, Card, Chip, Field, Footer, Grid, Header, Progress, Screen, Scroll, Sheet, T } from '@/components/ui';
import { AI_MODE, AI_READS_FILES, generateReviewer, readAsBase64, READABLE_TYPES, withTimeout, type Attachment } from '@/lib/ai';
import { photoAttachment } from '@/lib/images';
import { notify } from '@/lib/confirm';
import { useAuth, useUid } from '@/lib/auth-context';
import { saveReviewer, useFolders } from '@/lib/db';
import { storage } from '@/lib/firebase';
import type { Difficulty, SourceType } from '@/lib/types';
import { C, F, shadow } from '@/theme';

type Picked = { uri: string; name: string; mimeType: string; width?: number };

/** Photos of notes per reviewer. The functions mode reads only one uploaded file. */
const MAX_PHOTOS = AI_MODE === 'functions' ? 1 : 10;
const COUNTS = [5, 10, 20];
const MAX_COUNT = 60;

const SOURCES: { id: SourceType; label: string; sub: string; icon: IconName }[] = [
  { id: 'text', label: 'Paste', sub: 'Notes', icon: 'paste' },
  { id: 'file', label: 'File', sub: 'PDF or TXT', icon: 'file' },
  { id: 'photo', label: 'Photos', sub: 'Of notes', icon: 'camera' },
];

/** Only used in "functions" mode, where the server reads the file from Cloud Storage. */
async function upload(uid: string, file: Picked) {
  const path = `users/${uid}/uploads/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
  const blob = await (await fetch(file.uri)).blob();
  await withTimeout(uploadBytes(ref(storage, path), blob, { contentType: file.mimeType }), 60_000, 'Upload is taking too long. Is Firebase Storage set up?');
  return path;
}

export default function AddReviewer() {
  const params = useLocalSearchParams<{ folderId?: string; title?: string }>();
  const uid = useUid();
  const { profile } = useAuth();
  const { data: folders } = useFolders(uid);
  const [source, setSource] = useState<SourceType>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<Picked | null>(null);
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [addPhoto, setAddPhoto] = useState(false);
  const [custom, setCustom] = useState(false);
  const [title, setTitle] = useState(params.title ?? '');
  const [folderId, setFolderId] = useState<string | null>(params.folderId ?? null);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [step, setStep] = useState<'form' | 'working'>('form');
  const [stage, setStage] = useState(0);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      // Gemini reads PDF and plain text. Word / PowerPoint: save as PDF first.
      type: READABLE_TYPES,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    setFile({ uri: a.uri, name: a.name, mimeType: a.mimeType ?? 'application/octet-stream' });
    if (!title) setTitle(a.name.replace(/\.[^.]+$/, ''));
  };

  /** Adds photos from the gallery (several at once) or one from the camera. */
  const pickPhotos = async (camera: boolean) => {
    setAddPhoto(false);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return notify('That’s the limit', `You can add up to ${MAX_PHOTOS} photos per reviewer.`);
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Permission needed', `Allow ${camera ? 'camera' : 'photo'} access in Settings to add your notes.`);
    const res = camera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: room > 1, selectionLimit: room, orderedSelection: true });
    if (res.canceled) return;
    const added = res.assets.slice(0, room).map((a, i) => ({ uri: a.uri, name: a.fileName ?? `notes-${Date.now()}-${i}.jpg`, mimeType: a.mimeType ?? 'image/jpeg', width: a.width }));
    setPhotos((list) => [...list, ...added]);
  };

  const setCountSafe = (n: number) => setCount(Math.min(MAX_COUNT, Math.max(1, Math.round(n) || 1)));

  const ready = title.trim() && (source === 'text' ? text.trim().length > 20 : source === 'file' ? !!file : photos.length > 0);

  const generate = async () => {
    setStep('working');
    setStage(0);
    try {
      const files = source === 'file' ? (file ? [file] : []) : source === 'photo' ? photos : [];
      // functions mode uploads the file for the server; gemini mode sends the files straight to Gemini.
      const storagePath = files.length && AI_MODE === 'functions' ? await upload(uid, files[0]) : null;
      let attachments: Attachment[] | undefined;
      if (files.length && AI_MODE === 'gemini')
        attachments = source === 'photo'
          ? await Promise.all(photos.map((p) => photoAttachment(p.uri, p.width)))
          : [{ mimeType: files[0].mimeType, base64: await readAsBase64(files[0].uri) }];
      setStage(1);
      const out = await withTimeout(
        generateReviewer({ title, sourceType: source, text: source === 'text' ? text : undefined, storagePath, attachments, count, difficulty }),
        240_000,
        'The AI is taking too long. Check your internet and try again.',
      );
      setStage(2);
      const id = await saveReviewer(uid, { title: title.trim(), folderId, sourceType: source, sourcePath: storagePath, summary: out.summary, difficulty }, out.questions);
      router.replace({ pathname: '/reviewer/[id]', params: { id } });
    } catch (e) {
      setStep('form');
      notify('Could not make the reviewer', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (step === 'working') {
    const steps = [source === 'text' ? 'Reading your notes' : AI_MODE === 'functions' ? 'Uploading your lesson' : 'Reading your lesson', 'Writing the questions', 'Saving your reviewer'];
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 8 }}>
          <View style={{ alignItems: 'center' }}><Robot size={130} outfit={profile?.outfit} intro="think" idleGesture="think" idleEvery={2600} /></View>
          <T w={900} size={24} style={{ textAlign: 'center', marginTop: 8 }}>Making your reviewer…</T>
          <T color={C.muted} style={{ textAlign: 'center' }}>{AI_MODE === 'mock' ? 'Practice mode: questions are made on your phone.' : `Gemini is writing your questions. This can take ${count > 30 ? 'a few minutes' : 'up to a minute'}.`}</T>
          <Progress value={((stage + 1) / 3) * 100} height={10} style={{ flex: 0, marginVertical: 18 }} />
          {steps.map((label, i) => (
            <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < stage ? C.success50 : i === stage ? C.primary100 : C.chip }}>
                {i < stage && <Icon name="check" size={16} color={C.success} strokeWidth={3} />}
              </View>
              <T w={800} color={i < stage ? C.success : i === stage ? C.ink : C.faint}>{label}</T>
            </View>
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="New reviewer" sub="AI makes a new stage from your lesson" right={<Robot size={56} intro="wave" mood="excited" />} />
        <Scroll>
          <Step n={1} title="Add your lesson">
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {SOURCES.map((s) => {
                const on = source === s.id;
                return (
                  <Pressable key={s.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setSource(s.id)}
                    style={{ flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 16, borderWidth: 2, borderColor: on ? C.primary : C.line, backgroundColor: on ? C.primary50 : C.surface }}>
                    <Icon name={s.icon} size={24} color={on ? C.primary700 : C.muted} />
                    <T w={800} color={on ? C.primary700 : C.ink}>{s.label}</T>
                    <T w={600} size={12} color={C.muted}>{s.sub}</T>
                  </Pressable>
                );
              })}
            </View>
            {source === 'text' && (
              <Field label="Your notes" value={text} onChangeText={setText} multiline placeholder={'Paste your lesson here.\n\nTip: sentences like "Photosynthesis is how plants make food." become questions.'} hint={`${text.trim().length} characters`} />
            )}
            {source === 'file' && (
              <Pressable accessibilityRole="button" onPress={pickFile} style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#F8FBFF', borderRadius: 16, padding: 18, alignItems: 'center', gap: 4 }}>
                <Icon name={file ? 'check' : 'upload'} size={28} color={C.primary700} />
                <T w={800} color={C.primary700} style={{ textAlign: 'center' }}>{file ? file.name : 'Choose a file'}</T>
                <T w={600} size={13} color={C.muted} style={{ textAlign: 'center' }}>{file ? 'Tap to change' : 'PDF or TXT · Word/PPT: save as PDF first'}</T>
              </Pressable>
            )}
            {source === 'photo' && (
              <>
                <Grid columns={3} gap={8}>
                  {[
                    ...photos.map((p, i) => (
                      <View key={p.uri} style={{ aspectRatio: 3 / 4, borderRadius: 14, overflow: 'hidden', backgroundColor: C.chip }}>
                        <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} accessibilityLabel={`Photo ${i + 1}`} />
                        <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: 'rgba(15,23,42,.7)', borderRadius: 99, paddingHorizontal: 7 }}>
                          <T w={900} size={12} color="#fff">{i + 1}</T>
                        </View>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} hitSlop={6} onPress={() => setPhotos((l) => l.filter((x) => x.uri !== p.uri))}
                          style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(15,23,42,.75)', alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name="x" size={16} color="#fff" strokeWidth={3} />
                        </Pressable>
                      </View>
                    )),
                    ...(photos.length < MAX_PHOTOS
                      ? [
                          <Pressable key="add" accessibilityRole="button" accessibilityLabel="Add photos" onPress={() => setAddPhoto(true)}
                            style={{ aspectRatio: 3 / 4, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', borderColor: '#93C5FD', backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <Icon name="plus" size={26} color={C.primary700} strokeWidth={2.6} />
                            <T w={800} size={13} color={C.primary700}>{photos.length ? 'Add more' : 'Add photos'}</T>
                          </Pressable>,
                        ]
                      : []),
                  ]}
                </Grid>
                <T w={600} size={13} color={C.muted}>{photos.length ? `${photos.length} of ${MAX_PHOTOS} photos · read in this order` : `Add up to ${MAX_PHOTOS} photos of your notes or book pages.`}</T>
              </>
            )}
            {source !== 'text' && !AI_READS_FILES && (
              <T size={13} color={C.amber800} w={700}>Practice mode can’t read files, so it uses sample PE questions. Set EXPO_PUBLIC_AI_MODE=gemini to read your real lesson.</T>
            )}
          </Step>

          <Step n={2} title="Name it">
            {/* grow: long names wrap onto a second line, so the start of the name is always visible. */}
            <Field label="Reviewer name" grow value={title} onChangeText={setTitle} placeholder="PE Reviewer · Lessons 1–2" maxLength={80} />
            <SubjectPicker uid={uid} folders={folders} value={folderId} onChange={setFolderId} />
          </Step>

          <Step n={3} title="How many and how hard?">
            <T w={800} size={14.5} color={C.ink2}>Number of questions</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {COUNTS.map((n) => <Chip key={n} title={String(n)} on={!custom && count === n} onPress={() => { setCustom(false); setCount(n); }} style={{ flex: 1, paddingHorizontal: 4 }} />)}
              <Chip title="Custom" on={custom} onPress={() => setCustom(true)} style={{ flex: 1.5, paddingHorizontal: 4 }} />
            </View>
            {custom && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' }}>
                <Stepper icon="minus" label="Fewer questions" onPress={() => setCountSafe(count - 1)} disabled={count <= 1} />
                <TextInput value={String(count)} onChangeText={(v) => setCountSafe(Number(v.replace(/[^0-9]/g, '')))} keyboardType="number-pad" maxLength={2} selectTextOnFocus
                  accessibilityLabel="Number of questions"
                  style={{ width: 72, height: 52, borderRadius: 14, borderWidth: 2, borderColor: C.primary, textAlign: 'center', fontFamily: F.black, fontSize: 22, color: C.ink }} />
                <Stepper icon="plus" label="More questions" onPress={() => setCountSafe(count + 1)} disabled={count >= MAX_COUNT} />
                <T w={700} size={13} color={C.muted}>max {MAX_COUNT}</T>
              </View>
            )}
            <T w={800} size={14.5} color={C.ink2}>Difficulty</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((d) => <Chip key={d} title={d} on={difficulty === d} onPress={() => setDifficulty(d)} style={{ flex: 1, paddingHorizontal: 4 }} />)}
            </View>
          </Step>
        </Scroll>
        <Footer>
          <Btn title="Generate reviewer" icon="sparkles" onPress={generate} disabled={!ready} />
          {!ready && <T size={13} color={C.muted} style={{ textAlign: 'center', marginTop: 8 }}>Add your lesson and a name to continue</T>}
        </Footer>
      </KeyboardAvoidingView>
      <Sheet visible={addPhoto} onClose={() => setAddPhoto(false)} title="Add photos of your notes">
        <Btn icon="image" title="Choose from gallery" onPress={() => pickPhotos(false)} />
        <Btn icon="camera" variant="ghost" title="Take a photo" onPress={() => pickPhotos(true)} />
      </Sheet>
    </Screen>
  );
}

function Stepper({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary50, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={22} color={C.primary700} strokeWidth={3} />
    </Pressable>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card style={{ marginBottom: 14, gap: 14, ...shadow }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
          <T w={900} size={14} color="#fff">{n}</T>
        </View>
        <T w={900} size={17}>{title}</T>
      </View>
      {children}
    </Card>
  );
}
