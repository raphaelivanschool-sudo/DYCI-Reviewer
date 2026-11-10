import { Image, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

import { CHARACTERS, levelInfo } from '@/lib/game';
import type { Avatar, Outfit } from '@/lib/types';
import { C } from '@/theme';

import { Icon } from './Icon';
import { Robot } from './Robot';
import { T } from './ui';

/** Gold "LEVEL 5" block with a pressable-looking edge. */
export function LevelBadge({ xp, size = 46 }: { xp?: number; size?: number }) {
  const { level } = levelInfo(xp);
  return (
    <View accessibilityLabel={`Level ${level}`} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: '#FBBF24', borderBottomWidth: 4, borderBottomColor: '#B45309', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: -8, backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 6 }}>
        <T w={900} size={8.5} color={C.navy} style={{ letterSpacing: 0.5, lineHeight: 12 }}>LEVEL</T>
      </View>
      <T w={900} size={size * 0.42} color="#422006">{level}</T>
    </View>
  );
}

/** XP progress toward the next level (for colored headers). */
export function XpBar({ xp, light = true, height = 14 }: { xp?: number; light?: boolean; height?: number }) {
  const info = levelInfo(xp);
  const pct = Math.round((info.into / Math.max(1, info.need)) * 100);
  return (
    <View style={{ flex: 1 }} accessibilityLabel={`${info.into} of ${info.need} XP to level ${info.level + 1}`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <T w={800} size={13} color={light ? '#fff' : C.ink}>{info.title}</T>
        <T w={800} size={13} color={light ? '#BFDBFE' : C.muted}>{info.into} / {info.need} XP</T>
      </View>
      <View style={{ height, borderRadius: 99, backgroundColor: light ? 'rgba(255,255,255,0.18)' : '#EEF2F7', overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: '100%', borderRadius: 99, backgroundColor: '#FBBF24' }} />
      </View>
    </View>
  );
}

export function StarsRow({ stars, size = 26 }: { stars: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end' }} accessibilityLabel={`${stars} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <Svg key={i} width={i === 1 ? size * 1.3 : size} height={i === 1 ? size * 1.3 : size} viewBox="0 0 24 24">
          <Path d="m12 2.8 2.9 5.9 6.4.9-4.7 4.6 1.1 6.4L12 17.6l-5.7 3 1.1-6.4L2.7 9.6l6.4-.9z"
            fill={i < stars ? '#FBBF24' : 'rgba(148,163,184,0.35)'} stroke={i < stars ? '#B45309' : 'rgba(148,163,184,0.6)'} strokeWidth={1.2} strokeLinejoin="round" />
        </Svg>
      ))}
    </View>
  );
}

/** Profile picture: an uploaded photo, a built-in character, or METANOIA wearing the user's outfit. */
export function AvatarView({ avatar, outfit, size = 46, ring = '#FBBF24', style }: { avatar?: Avatar; outfit?: Outfit; size?: number; ring?: string; style?: ViewStyle }) {
  const box: ViewStyle = { width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size / 20), borderColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' };
  if (avatar?.kind === 'photo')
    return (
      <View style={[box, { backgroundColor: ring }, style]} accessibilityLabel="Profile photo">
        <Image source={{ uri: avatar.dataUri }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  const id = avatar?.kind === 'character' ? avatar.id : 'metanoia';
  const ch = CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
  return (
    <View style={[box, { backgroundColor: id === 'metanoia' ? ring : ch.bg }, style]} accessibilityLabel={`Character ${ch.label}`}>
      {id === 'metanoia' ? <Robot size={size * 0.86} outfit={outfit} still /> : <CharacterArt id={id} size={size * 0.92} />}
    </View>
  );
}

/** Simple original characters for profile pictures. */
export function CharacterArt({ id, size }: { id: string; size: number }) {
  const c = CHARACTERS.find((x) => x.id === id) ?? CHARACTERS[1];
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Circle cx={28} cy={28} r={26} fill={c.fg} />
      {id === 'sunny' && (<><Circle cx={28} cy={24} r={12} fill="#FDE68A" /><Circle cx={24} cy={23} r={2} fill="#422006" /><Circle cx={32} cy={23} r={2} fill="#422006" /><Path d="M23 28q5 4 10 0" stroke="#422006" strokeWidth={2} fill="none" strokeLinecap="round" /><Path d="M12 48q16-14 32 0" fill="#FDE68A" /></>)}
      {id === 'scholar' && (<><Path d="M14 22 28 10l14 12v14H14z" fill="#FBBF24" /><Circle cx={23} cy={26} r={3} fill="#1E3A8A" /><Circle cx={33} cy={26} r={3} fill="#1E3A8A" /><Path d="M22 32h12" stroke="#1E3A8A" strokeWidth={2.5} strokeLinecap="round" /></>)}
      {id === 'kit' && (<><Path d="M15 22l5-9 5 8M41 22l-5-9-5 8" fill="#fff" /><Ellipse cx={28} cy={30} rx={14} ry={12} fill="#fff" /><Circle cx={23} cy={28} r={2.5} fill="#0F172A" /><Circle cx={33} cy={28} r={2.5} fill="#0F172A" /><Path d="M25 34q3 2 6 0" stroke="#0F172A" strokeWidth={2} fill="none" strokeLinecap="round" /></>)}
      {id === 'mochi' && (<><Circle cx={18} cy={17} r={5} fill="#FBCFE8" /><Circle cx={38} cy={17} r={5} fill="#FBCFE8" /><Circle cx={28} cy={29} r={13} fill="#FBCFE8" /><Circle cx={23} cy={28} r={2} fill="#831843" /><Circle cx={33} cy={28} r={2} fill="#831843" /><Path d="M24 33q4 3 8 0" stroke="#831843" strokeWidth={2} fill="none" strokeLinecap="round" /></>)}
      {id === 'bolt' && (<><Circle cx={28} cy={12} r={3} fill="#FBBF24" /><Rect x={16} y={18} width={24} height={22} rx={8} fill="#E0F2FE" /><Rect x={20} y={24} width={16} height={7} rx={3.5} fill="#1E3A8A" /></>)}
      {id === 'king' && (<><Path d="M16 24l6-10 6 6 6-6 6 10v6H16z" fill="#FDE68A" /><Circle cx={28} cy={38} r={8} fill="#fff" /><Circle cx={25} cy={37} r={1.6} fill="#422006" /><Circle cx={31} cy={37} r={1.6} fill="#422006" /></>)}
      {id === 'star' && (<Path d="m28 12 4.4 9 9.9 1.4-7.2 7 1.7 9.8L28 34.6l-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z" fill="#FDE68A" />)}
    </Svg>
  );
}

/** Small reward pill: "+20 XP". */
export function XpPill({ xp }: { xp: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.amber50, paddingHorizontal: 8, height: 26, borderRadius: 99 }}>
      <Icon name="sparkles" size={13} color="#B45309" />
      <T w={900} size={12.5} color="#B45309">+{xp} XP</T>
    </View>
  );
}
