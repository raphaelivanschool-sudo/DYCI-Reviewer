import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';

import { notify } from '@/lib/confirm';
import { setAvatar } from '@/lib/db';
import { sheetPanel } from '@/lib/responsive';
import { CHARACTERS, levelInfo } from '@/lib/game';
import type { UserProfile } from '@/lib/types';
import { C } from '@/theme';

import { AvatarView, CharacterArt } from './game';
import { Icon } from './Icon';
import { Robot } from './Robot';
import { Btn, Grid, T } from './ui';

/** Photos are shrunk to a small square JPEG and kept on the profile document (no Cloud Storage needed). */
async function toAvatarDataUri(uri: string) {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 256, height: 256 }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error('Could not read the photo.');
  return `data:image/jpeg;base64,${out.base64}`;
}

export function AvatarPicker({ uid, profile, visible, onClose }: { uid: string; profile: UserProfile; visible: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const level = levelInfo(profile.stats.xp).level;
  const current = profile.avatar?.kind === 'character' ? profile.avatar.id : profile.avatar ? null : 'metanoia';

  const pickPhoto = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return notify('Permission needed', `Allow ${camera ? 'camera' : 'photo'} access in Settings to change your picture.`);
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
    const res = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled) return;
    setBusy(true);
    try {
      await setAvatar(uid, { kind: 'photo', dataUri: await toAvatarDataUri(res.assets[0].uri) });
      onClose();
    } catch (e) {
      notify('Could not use that photo', e instanceof Error ? e.message : 'Please try another one.');
    } finally {
      setBusy(false);
    }
  };

  const choose = async (id: string) => {
    await setAvatar(uid, { kind: 'character', id });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Close" onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,.5)' }} />
      <View style={[sheetPanel, { maxHeight: '85%' }]}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 34, gap: 14 }}>
          <View style={{ width: 40, height: 5, borderRadius: 9, backgroundColor: '#CBD5E1', alignSelf: 'center' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AvatarView avatar={profile.avatar} outfit={profile.outfit} size={56} />
            <T w={900} size={19} style={{ flex: 1 }}>Change profile picture</T>
            {busy && <ActivityIndicator color={C.primary} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn small variant="ghost" icon="image" title="Upload" style={{ flex: 1 }} onPress={() => pickPhoto(false)} disabled={busy} />
            <Btn small variant="ghost" icon="camera" title="Camera" style={{ flex: 1 }} onPress={() => pickPhoto(true)} disabled={busy} />
          </View>
          <T w={900} size={13} color={C.muted} style={{ letterSpacing: 0.6 }}>OR CHOOSE A CHARACTER</T>
          <Grid columns={4} gap={8}>
            {CHARACTERS.map((c) => {
              const locked = level < c.level;
              const on = current === c.id;
              return (
                <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={locked ? `${c.label}, locked until level ${c.level}` : c.label}
                  accessibilityState={{ selected: on, disabled: locked }} disabled={locked} onPress={() => choose(c.id)}
                  style={{ aspectRatio: 1, borderRadius: 20, borderWidth: 3, borderBottomWidth: 5, alignItems: 'center', justifyContent: 'center',
                    borderColor: on ? C.primary : C.line, backgroundColor: locked ? '#F1F5F9' : c.bg }}>
                  <View style={{ opacity: locked ? 0.4 : 1 }}>
                    {c.id === 'metanoia' ? <Robot size={54} outfit={profile.outfit} still /> : <CharacterArt id={c.id} size={52} />}
                  </View>
                  {locked && (
                    <View style={{ position: 'absolute', right: 5, top: 5, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="lock" size={12} color={C.muted} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Grid>
          <T w={700} size={12.5} color={C.muted} style={{ textAlign: 'center' }}>Locked characters unlock at {CHARACTERS.filter((c) => c.level > 1).map((c) => `Level ${c.level}`).join(' and ')}.</T>
        </ScrollView>
      </View>
    </Modal>
  );
}
