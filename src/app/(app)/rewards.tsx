import { Pressable, View } from 'react-native';

import { CharacterArt, XpBar } from '@/components/game';
import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Header, Screen, Scroll, T } from '@/components/ui';
import { useAuth, useUid } from '@/lib/auth-context';
import { notify } from '@/lib/confirm';
import { updateProfileFields } from '@/lib/db';
import { CHARACTERS, LEVEL_REWARDS, levelInfo, xpForLevel, type LevelReward } from '@/lib/game';
import { DEFAULT_OUTFIT } from '@/lib/types';
import { C } from '@/theme';

/** Every level's prize: robot skins and profile picture characters. Unlocked skins can be worn here. */
export default function Rewards() {
  const uid = useUid();
  const { profile } = useAuth();
  if (!profile) return null;

  const xp = profile.stats.xp ?? 0;
  const lvl = levelInfo(xp);
  const outfit = profile.outfit ?? DEFAULT_OUTFIT;
  const wornSkin = outfit.skin ?? 'classic';
  const avatarId = profile.avatar?.kind === 'character' ? profile.avatar.id : null;

  const use = async (r: LevelReward) => {
    try {
      if (r.kind === 'skin') await updateProfileFields(uid, { outfit: { ...outfit, skin: wornSkin === r.id ? 'classic' : r.id } });
      else await updateProfileFields(uid, { avatar: { kind: 'character', id: r.id } });
    } catch {
      notify('Could not save', 'Check your internet connection and try again.');
    }
  };

  return (
    <Screen>
      <Header title="Level rewards" sub={`LV ${lvl.level} ${lvl.title} · ${lvl.toNext} XP to Level ${lvl.level + 1}`}>
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}><XpBar xp={xp} /></View>
      </Header>
      <Scroll style={{ gap: 8 }}>
        <T w={700} size={13.5} color={C.muted} style={{ marginBottom: 4 }}>Level up by answering reviewers. Every level gives a prize.</T>
        {LEVEL_REWARDS.map((r) => {
          const unlocked = lvl.level >= r.level;
          const isNext = !unlocked && LEVEL_REWARDS.find((x) => x.level > lvl.level) === r;
          const inUse = r.kind === 'skin' ? wornSkin === r.id : avatarId === r.id;
          const status = !unlocked
            ? isNext ? `${xpForLevel(r.level) - xp} XP to go` : r.kind === 'skin' ? 'Robot skin' : 'Profile picture'
            : r.kind === 'skin' ? 'Robot skin · tap to wear' : 'Profile picture · tap to use';
          return (
            <Pressable key={r.level} accessibilityRole="button" disabled={!unlocked} onPress={() => use(r)}
              accessibilityLabel={`Level ${r.level}: ${r.label}. ${unlocked ? (inUse ? 'In use' : 'Unlocked') : 'Locked'}`}
              accessibilityState={{ disabled: !unlocked, selected: inUse }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 18, padding: 10,
                borderWidth: 2, borderColor: inUse ? C.primary : isNext ? '#FCD34D' : 'transparent', borderBottomWidth: 4,
                borderBottomColor: inUse ? C.primary : isNext ? '#FCD34D' : C.line, opacity: pressed ? 0.85 : 1,
              })}>
              <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: unlocked ? '#FBBF24' : C.line, borderBottomWidth: 3, borderBottomColor: unlocked ? '#B45309' : '#CBD5E1' }}>
                <T w={900} size={15} color={unlocked ? '#422006' : C.muted}>{r.level}</T>
              </View>
              <View style={{ width: 54, height: 54, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: unlocked ? 1 : 0.55,
                backgroundColor: r.kind === 'avatar' ? CHARACTERS.find((c) => c.id === r.id)?.bg ?? C.chip : C.primary50 }}>
                {r.kind === 'skin' ? <Robot size={54} skin={r.id} outfit={{ ...outfit, skin: r.id }} still /> : <CharacterArt id={r.id} size={48} />}
              </View>
              <View style={{ flex: 1 }}>
                <T w={900} size={15.5}>{r.label}</T>
                <T w={700} size={12.5} color={isNext ? '#B45309' : C.muted}>{status}</T>
              </View>
              {inUse ? (
                <View style={{ backgroundColor: C.primary, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}><T w={900} size={12} color="#fff">In use</T></View>
              ) : unlocked ? (
                <View style={{ backgroundColor: C.success50, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}><T w={900} size={12} color={C.success700}>Unlocked</T></View>
              ) : (
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: C.chip, alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={15} color={C.muted} /></View>
              )}
            </Pressable>
          );
        })}
      </Scroll>
    </Screen>
  );
}
