import { Image } from 'expo-image';
import { createContext, use, useEffect, useImperativeHandle, type ReactNode, type Ref } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { Gesture } from '@/lib/ai';
import type { Outfit } from '@/lib/types';

import { SKIN_LAYERS, type RobotSkinId } from './robot-skins';

/**
 * METANOIA the robot, from the 3D model in blender/METANOIA_Robot_3D_Character.blend.
 * Each moving part (wings, upper arms, forearms, head) is a rendered picture in assets/robot/,
 * stacked and turned at its real joint, so gestures move the 3D parts. The LED eyes and outfits
 * are drawn on top, so moods and outfits still work.
 *
 * Re-render the pictures after changing the model: see blender/app-export/README.md.
 * Add a gesture: add a case in `play()` below and a label in GESTURES.
 * Add an outfit: draw it in OUTFIT_ART and list it in OUTFIT_ITEMS (with an unlock rule if needed).
 */

const NAVY = '#1E3A8A';
const LED = '#38BDF8';
export const GESTURES: { id: Gesture; label: string; line: string }[] = [
  { id: 'wave', label: 'Wave', line: 'Hi there!' },
  { id: 'cheer', label: 'Cheer', line: 'Great job!' },
  { id: 'nod', label: 'Yes', line: 'Yes, got it!' },
  { id: 'no', label: 'No', line: 'Hmm, not quite.' },
  { id: 'think', label: 'Think', line: 'Let me think...' },
  { id: 'dance', label: 'Dance', line: 'Study break!' },
  { id: 'sleep', label: 'Sleep', line: 'Zzz... rest time.' },
];

// ------------------------------------------------------------------ 3D layers
// Positions come from blender/app-export (layout.json): fractions of the square render.
// "Left"/"Right" here mean the left/right side of the screen.
type Rect4 = [x: number, y: number, w: number, h: number];
const PART: Record<string, { src: number; rect: Rect4 }> = {
  wingLeft: { src: require('../../assets/robot/robot-wingR.webp'), rect: [0.0303, 0.3115, 0.46, 0.3418] },
  wingRight: { src: require('../../assets/robot/robot-wingL.webp'), rect: [0.5098, 0.3115, 0.46, 0.3418] },
  upperLeft: { src: require('../../assets/robot/robot-upperR.webp'), rect: [0.3203, 0.4033, 0.0605, 0.1367] },
  lowerLeft: { src: require('../../assets/robot/robot-lowerR.webp'), rect: [0.3223, 0.5293, 0.0586, 0.2061] },
  upperRight: { src: require('../../assets/robot/robot-upperL.webp'), rect: [0.6191, 0.4033, 0.0605, 0.1367] },
  lowerRight: { src: require('../../assets/robot/robot-lowerL.webp'), rect: [0.6191, 0.5293, 0.0586, 0.2061] },
  body: { src: require('../../assets/robot/robot-body.webp'), rect: [0.2988, 0.2168, 0.4023, 0.7637] },
  fin: { src: require('../../assets/robot/robot-fin.webp'), rect: [0.4912, 0.0693, 0.0176, 0.0615] },
  head: { src: require('../../assets/robot/robot-head.webp'), rect: [0.4277, 0.0996, 0.1445, 0.1387] },
};
/** Joints, as fractions of the render: [x, y]. */
const PIVOT = {
  wingLeft: [0.4434, 0.3586],
  wingRight: [0.5566, 0.3586],
  shoulderLeft: [0.3501, 0.4021],
  shoulderRight: [0.6499, 0.4021],
  elbowLeft: [0.3511, 0.5261],
  elbowRight: [0.6489, 0.5261],
  neck: [0.5, 0.2347],
  feet: [0.5, 0.9494],
};
const origin = ([x, y]: number[]) => `${x * 100}% ${y * 100}%`;
/** LED eye centers on the visor, in 0-1000 units of the render. */
const EYES = [471.5, 528.5];
const EYE_Y = 164;

/**
 * How much of the robot to show. The model is a full-size robot, so small avatars zoom in on the
 * head and chest (otherwise the face would be a few pixels), big ones show the whole body.
 */
export type RobotFrame = 'full' | 'half' | 'bust';
const FRAMES: Record<RobotFrame, { zoom: number; top: number }> = {
  full: { zoom: 1, top: 0.02 },
  half: { zoom: 1.65, top: 0.05 },
  bust: { zoom: 2.9, top: 0.06 },
};
const frameFor = (size: number): RobotFrame => (size >= 170 ? 'full' : size >= 100 ? 'half' : 'bust');

// ------------------------------------------------------------------ outfits
// Drawn on the old 200x200 robot; OUTFIT_FIT moves each slot onto the 3D robot's head, face and neck.
const OUTFIT_FIT = { head: 'translate(370 55) scale(1.3)', face: 'translate(340 13.6) scale(1.6)', neck: 'translate(370 55.7) scale(1.3)' };
const OUTFIT_ART: Record<'head' | 'face' | 'neck', Record<string, ReactNode>> = {
  head: {
    cap: (
      <G>
        <Path d="M66 38v16q34 14 68 0V38z" fill="#1E293B" />
        <Path d="M100 14 156 32 100 50 44 32z" fill="#0F172A" stroke="#334155" strokeWidth={2} strokeLinejoin="round" />
        <Path d="M100 32 150 38v22" fill="none" stroke="#F59E0B" strokeWidth={3} strokeLinecap="round" />
        <Circle cx={150} cy={63} r={5} fill="#F59E0B" />
        <Circle cx={100} cy={32} r={4} fill="#F59E0B" />
      </G>
    ),
    headphones: (
      <G>
        <Path d="M38 92Q38 30 100 30Q162 30 162 92" fill="none" stroke="#DC2626" strokeWidth={9} strokeLinecap="round" />
        <Rect x={20} y={74} width={24} height={40} rx={11} fill="#DC2626" stroke="#7F1D1D" strokeWidth={4} />
        <Rect x={156} y={74} width={24} height={40} rx={11} fill="#DC2626" stroke="#7F1D1D" strokeWidth={4} />
      </G>
    ),
    beanie: (
      <G>
        <Path d="M46 62Q46 22 100 22Q154 22 154 62z" fill="#F59E0B" stroke="#B45309" strokeWidth={4} strokeLinejoin="round" />
        <Rect x={42} y={52} width={116} height={15} rx={7.5} fill="#D97706" stroke="#B45309" strokeWidth={4} />
        <Circle cx={100} cy={18} r={10} fill="#FDE68A" stroke="#B45309" strokeWidth={4} />
      </G>
    ),
    crown: (
      <G>
        <Path d="M64 50 68 16 86 34 100 8 114 34 132 16 136 50z" fill="#FACC15" stroke="#A16207" strokeWidth={4} strokeLinejoin="round" />
        <Circle cx={100} cy={38} r={5} fill="#DC2626" />
        <Circle cx={80} cy={42} r={3.5} fill="#2563EB" />
        <Circle cx={120} cy={42} r={3.5} fill="#2563EB" />
      </G>
    ),
  },
  face: {
    glasses: (
      <G>
        <Circle cx={83} cy={94} r={15} fill="none" stroke="#F8FAFC" strokeWidth={4} />
        <Circle cx={117} cy={94} r={15} fill="none" stroke="#F8FAFC" strokeWidth={4} />
        <Path d="M98 92 Q100 88 102 92M68 91 59 86M132 91 141 86" fill="none" stroke="#F8FAFC" strokeWidth={4} strokeLinecap="round" />
      </G>
    ),
    shades: (
      <G>
        <Path d="M64 84h34v10a12 12 0 0 1-12 12h-10a12 12 0 0 1-12-12z" fill="#0F172A" stroke="#F8FAFC" strokeWidth={3} />
        <Path d="M102 84h34v10a12 12 0 0 1-12 12h-10a12 12 0 0 1-12-12z" fill="#0F172A" stroke="#F8FAFC" strokeWidth={3} />
        <Path d="M98 88h4" stroke="#F8FAFC" strokeWidth={3} />
      </G>
    ),
  },
  neck: {
    bowtie: (
      <G>
        <Path d="M100 151 80 141v21zM100 151l20-10v21z" fill="#DC2626" stroke="#7F1D1D" strokeWidth={3} strokeLinejoin="round" />
        <Circle cx={100} cy={151} r={5} fill="#7F1D1D" />
      </G>
    ),
    necktie: <Path d="M94 146h12l-3 8 6 22-9 10-9-10 6-22z" fill="#7C3AED" stroke="#4C1D95" strokeWidth={3} strokeLinejoin="round" />,
  },
};

export type UnlockStats = { streak: number; perfectScores: number; reviewers: number };
export const OUTFIT_ITEMS: { slot: 'head' | 'face' | 'neck'; id: string; label: string; lock?: { text: string; ok: (s: UnlockStats) => boolean } }[] = [
  { slot: 'head', id: 'none', label: 'None' },
  { slot: 'head', id: 'cap', label: 'Grad cap' },
  { slot: 'head', id: 'headphones', label: 'Headphones' },
  { slot: 'head', id: 'beanie', label: 'Beanie', lock: { text: '7-day streak', ok: (s) => s.streak >= 7 } },
  { slot: 'head', id: 'crown', label: 'Crown', lock: { text: 'Score 100%', ok: (s) => s.perfectScores >= 1 } },
  { slot: 'face', id: 'none', label: 'None' },
  { slot: 'face', id: 'glasses', label: 'Glasses' },
  { slot: 'face', id: 'shades', label: 'Shades', lock: { text: '10 reviewers', ok: (s) => s.reviewers >= 10 } },
  { slot: 'neck', id: 'none', label: 'None' },
  { slot: 'neck', id: 'bowtie', label: 'Bow tie' },
  { slot: 'neck', id: 'necktie', label: 'Necktie' },
];

// ------------------------------------------------------------------ component
export type RobotHandle = { play: (g: Gesture | 'random') => Gesture };

/** Facial expression, shown on the LED eyes. */
export type Mood = 'happy' | 'excited' | 'proud' | 'sleepy' | 'worried';

type Props = {
  size: number;
  outfit?: Outfit;
  /** Gesture played once when the robot appears. */
  intro?: Gesture;
  /** Gesture repeated every `idleEvery` ms while mounted. */
  idleGesture?: Gesture;
  idleEvery?: number;
  /** Turn off breathing/blinking (e.g. for many small previews). */
  still?: boolean;
  style?: ViewStyle;
  mood?: Mood;
  /** Color skin (level reward). Default: the outfit's skin, else classic. */
  skin?: RobotSkinId;
  /** How much of the body to show. Default: picked from `size`. */
  frame?: RobotFrame;
  ref?: Ref<RobotHandle>;
};

const ease = Easing.inOut(Easing.quad);
const to = (v: number, ms: number) => withTiming(v, { duration: ms, easing: ease });

export function Robot({ size, outfit, skin, intro, idleGesture, idleEvery = 7000, still, style, mood = 'happy', frame, ref }: Props) {
  const reduceMotion = useReducedMotion();
  const o = outfit ?? { head: 'none', face: 'none', neck: 'none' };
  const f = FRAMES[frame ?? frameFor(size)];
  const stage = size * f.zoom; // size of the whole render on screen
  const u = stage / 1000; // px per render unit
  const k = size / 200; // px per old robot unit, for whole-body moves

  const allY = useSharedValue(0);
  const allRot = useSharedValue(0);
  const headRot = useSharedValue(0);
  const headY = useSharedValue(0);
  // Arms, by screen side: positive turns clockwise. Upper arm turns at the shoulder, forearm at the elbow.
  const upL = useSharedValue(0);
  const loL = useSharedValue(0);
  const upR = useSharedValue(0);
  const loR = useSharedValue(0);
  const blink = useSharedValue(1);
  const lids = useSharedValue(1);
  const eyeX = useSharedValue(0);
  const eyeY = useSharedValue(0);
  const zzz = useSharedValue(0);
  const wing = useSharedValue(0); // degrees the wing tips are raised
  const fold = useSharedValue(1); // 1 = wings spread, lower = folded in

  const all = [allY, allRot, headRot, headY, upL, loL, upR, loR, lids, eyeX, eyeY, zzz, wing, fold];

  const startIdle = () => {
    if (still || reduceMotion) return;
    allY.value = withRepeat(withSequence(to(-3 * k, 1600), to(0, 1600)), -1);
    // Slow wing beat, like the moving wings of the DYCI statue.
    wing.value = withRepeat(withSequence(to(7, 1500), to(-3, 1500)), -1);
    fold.value = withRepeat(withSequence(to(0.94, 1500), to(1, 1500)), -1);
    blink.value = withRepeat(withSequence(withDelay(4200, withTiming(0.1, { duration: 90 })), withTiming(1, { duration: 110 })), -1);
  };

  const play = (g: Gesture | 'random'): Gesture => {
    const id: Gesture = g === 'random' ? GESTURES[Math.floor(Math.random() * GESTURES.length)].id : g;
    all.forEach((v) => cancelAnimation(v));
    // Everything eases back to rest unless the gesture moves it.
    all.forEach((v) => (v.value = to(v === fold || v === lids ? 1 : 0, 200)));
    let ms = 1200;
    switch (id) {
      case 'wave':
        // Right arm up, forearm waves at the elbow.
        upR.value = withSequence(to(-150, 320), withDelay(1000, to(0, 320)));
        loR.value = withSequence(to(-25, 320), to(20, 230), to(-25, 230), to(20, 230), to(-25, 230), to(0, 320));
        headRot.value = withSequence(to(5, 320), withDelay(960, to(0, 320)));
        ms = 1700;
        break;
      case 'cheer':
        allY.value = withSequence(to(-16 * k, 320), to(0, 260), to(-9 * k, 220), to(0, 220));
        upL.value = withSequence(to(150, 260), to(165, 390), to(150, 390), to(0, 260));
        upR.value = withSequence(to(-150, 260), to(-165, 390), to(-150, 390), to(0, 260));
        loL.value = withSequence(to(15, 260), to(0, 390), to(15, 390), to(0, 260));
        loR.value = withSequence(to(-15, 260), to(0, 390), to(-15, 390), to(0, 260));
        wing.value = withSequence(to(18, 260), to(2, 260), to(18, 260), to(2, 260), to(0, 260));
        ms = 1300;
        break;
      case 'nod':
        headY.value = withSequence(to(9 * u, 270), to(0, 270), to(9 * u, 270), to(0, 270));
        ms = 1100;
        break;
      case 'no':
        headRot.value = withSequence(to(-9, 170), to(9, 220), to(-9, 220), to(9, 220), to(0, 170));
        ms = 1100;
        break;
      case 'think':
        // Hand to chin.
        upR.value = withSequence(to(40, 400), withDelay(1400, to(0, 400)));
        loR.value = withSequence(to(132, 400), to(124, 350), to(132, 350), to(128, 700), to(0, 400));
        headRot.value = withSequence(to(-7, 400), withDelay(1400, to(0, 400)));
        eyeX.value = withSequence(to(-6 * u, 400), withDelay(1400, to(0, 400)));
        eyeY.value = withSequence(to(-4 * u, 400), withDelay(1400, to(0, 400)));
        ms = 2200;
        break;
      case 'dance':
        allRot.value = withSequence(to(-7, 500), to(0, 500), to(7, 500), to(0, 500));
        allY.value = withSequence(to(-6 * k, 500), to(0, 500), to(-6 * k, 500), to(0, 500));
        upL.value = withSequence(to(80, 500), to(15, 500), to(80, 500), to(0, 500));
        loL.value = withSequence(to(50, 500), to(0, 500), to(50, 500), to(0, 500));
        upR.value = withSequence(to(-15, 500), to(-80, 500), to(-15, 500), to(0, 500));
        loR.value = withSequence(to(0, 500), to(-50, 500), to(0, 500), to(0, 500));
        headRot.value = withSequence(to(8, 500), to(0, 500), to(-8, 500), to(0, 500));
        wing.value = withSequence(to(14, 500), to(0, 500), to(14, 500), to(0, 500));
        ms = 2000;
        break;
      case 'sleep':
        lids.value = withSequence(to(0.15, 320), withDelay(1900, to(1, 380)));
        headRot.value = withSequence(to(6, 400), withDelay(1800, to(0, 400)));
        headY.value = withSequence(to(5 * u, 400), withDelay(1800, to(0, 400)));
        // Wings fold in and droop while it naps.
        wing.value = withSequence(to(-10, 500), withDelay(1700, to(0, 400)));
        fold.value = withSequence(to(0.55, 500), withDelay(1700, to(1, 400)));
        zzz.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }));
        ms = 2600;
        break;
    }
    setTimeout(startIdle, ms + 50);
    return id;
  };

  useImperativeHandle(ref, () => ({ play }));

  useEffect(() => {
    startIdle();
    const t = intro ? setTimeout(() => play(intro), 400) : undefined;
    const iv = idleGesture ? setInterval(() => play(idleGesture), idleEvery) : undefined;
    return () => {
      if (t) clearTimeout(t);
      if (iv) clearInterval(iv);
    };
    // Run once per mount; the robot keeps its own animation state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allStyle = useAnimatedStyle(() => ({ transform: [{ translateY: allY.value }, { rotate: `${allRot.value}deg` }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ translateY: headY.value }, { rotate: `${headRot.value}deg` }] }));
  const upLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${upL.value}deg` }] }));
  const loLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${loL.value}deg` }] }));
  const upRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${upR.value}deg` }] }));
  const loRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${loR.value}deg` }] }));
  // The left wing's tip points left, so turning clockwise lifts it; the right wing turns the other way.
  const wingLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wing.value}deg` }, { scaleX: fold.value }] }));
  const wingRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-wing.value}deg` }, { scaleX: fold.value }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: eyeX.value }, { translateY: eyeY.value }, { scaleY: blink.value * lids.value }] }));
  const zzzStyle = useAnimatedStyle(() => ({
    opacity: zzz.value === 0 ? 0 : Math.min(1, zzz.value * 5) * (1 - zzz.value),
    transform: [{ translateX: zzz.value * 14 * k }, { translateY: -zzz.value * 24 * k }],
  }));

  // Whole-body moves turn around the lowest visible point, so a zoomed-in robot doesn't swing off screen.
  const pivotY = Math.min(PIVOT.feet[1], f.top + 1 / f.zoom - 0.02);

  return (
    <SkinContext value={skinOf(skin ?? o.skin)}>
    <View style={[{ width: size, height: size, overflow: 'hidden' }, style]} pointerEvents="none" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
      <View style={{ position: 'absolute', width: stage, height: stage, left: (size - stage) / 2, top: -f.top * stage }}>
        {f.zoom === 1 && (
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000">
            <Ellipse cx={500} cy={962} rx={150} ry={13} fill={NAVY} opacity={0.13} />
          </Svg>
        )}
        <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `50% ${pivotY * 100}%` }, allStyle]}>
          {/* Wings behind everything. They beat slowly, like the DYCI METANOIA statue's wings. */}
          <Part name="wingLeft" style={[{ transformOrigin: origin(PIVOT.wingLeft) }, wingLStyle]} />
          <Part name="wingRight" style={[{ transformOrigin: origin(PIVOT.wingRight) }, wingRStyle]} />
          <Part name="body" />
          <Part name="upperLeft" style={[{ transformOrigin: origin(PIVOT.shoulderLeft) }, upLStyle]}>
            <Part name="lowerLeft" style={[{ transformOrigin: origin(PIVOT.elbowLeft) }, loLStyle]} />
          </Part>
          <Part name="upperRight" style={[{ transformOrigin: origin(PIVOT.shoulderRight) }, upRStyle]}>
            <Part name="lowerRight" style={[{ transformOrigin: origin(PIVOT.elbowRight) }, loRStyle]} />
          </Part>
          {o.neck !== 'none' && OUTFIT_ART.neck[o.neck] && (
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000">
              <G transform={OUTFIT_FIT.neck}>{OUTFIT_ART.neck[o.neck]}</G>
            </Svg>
          )}

          <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: origin(PIVOT.neck) }, headStyle]}>
            {/* The fin hides under hats, so they sit flat on the helmet. */}
            {o.head === 'none' && <Part name="fin" />}
            <Part name="head" />
            <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: `50% ${EYE_Y / 10}%` }, eyeStyle]}>
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000">
                <Eyes mood={mood} />
              </Svg>
            </Animated.View>
            {(o.face !== 'none' && OUTFIT_ART.face[o.face]) || (o.head !== 'none' && OUTFIT_ART.head[o.head]) ? (
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000">
                {o.face !== 'none' && <G transform={OUTFIT_FIT.face}>{OUTFIT_ART.face[o.face]}</G>}
                {o.head !== 'none' && <G transform={OUTFIT_FIT.head}>{OUTFIT_ART.head[o.head]}</G>}
              </Svg>
            ) : null}
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFill, zzzStyle]}>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000">
              <SvgText x={585} y={100} fontSize={44} fontWeight="900" fill="#2563EB">z</SvgText>
              <SvgText x={620} y={66} fontSize={30} fontWeight="900" fill="#2563EB">z</SvgText>
            </Svg>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
    </SkinContext>
  );
}

/** The skin the parts of one robot are drawn with. */
const SkinContext = createContext<RobotSkinId>('classic');
/** Unknown or missing skins (e.g. from a newer app version) fall back to the classic look. */
const skinOf = (s?: string): RobotSkinId => (s && s in SKIN_LAYERS ? (s as RobotSkinId) : 'classic');

/** One rendered part, placed on the full-size render so joints line up. Children turn with it. */
function Part({ name, style, children }: { name: keyof typeof PART; style?: object | object[]; children?: ReactNode }) {
  const skin = use(SkinContext);
  const { rect } = PART[name];
  const src = skin === 'classic' ? PART[name].src : SKIN_LAYERS[skin][name as keyof (typeof SKIN_LAYERS)['mint']];
  const [x, y, w, h] = rect;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image source={src} contentFit="fill" style={{ position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} />
      {children}
    </Animated.View>
  );
}

const star = (cx: number, cy: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join('') + 'Z';

/** LED eyes on the visor (0-1000 render units): a small dot grid like the model's lights. */
function Eyes({ mood }: { mood: Mood }) {
  if (mood === 'sleepy' || mood === 'proud') {
    const d = EYES.map((c) => (mood === 'sleepy' ? `M${c - 13} ${EYE_Y - 2}Q${c} ${EYE_Y + 7} ${c + 13} ${EYE_Y - 2}` : `M${c - 13} ${EYE_Y + 5}Q${c} ${EYE_Y - 10} ${c + 13} ${EYE_Y + 5}`)).join('');
    return <Path d={d} fill="none" stroke="#7DD3FC" strokeWidth={4.5} strokeLinecap="round" />;
  }
  if (mood === 'excited') return <Path d={EYES.map((c) => star(c, EYE_Y, 11)).join('')} fill="#FDE68A" />;
  return (
    <G>
      {EYES.map((c) => (
        <G key={c}>
          <Rect x={c - 17} y={EYE_Y - 9.5} width={34} height={19} rx={9} fill={LED} opacity={0.28} />
          {[0, 1, 2, 3].map((i) => [EYE_Y - 3.5, EYE_Y + 3.5].map((cy) => <Circle key={`${i}-${cy}`} cx={c - 11.25 + i * 7.5} cy={cy} r={2.7} fill="#BAE6FD" />))}
        </G>
      ))}
      {mood === 'worried' && <Path d={`M${EYES[0] - 14} ${EYE_Y - 10}L${EYES[0] + 10} ${EYE_Y - 16}M${EYES[1] + 14} ${EYE_Y - 10}L${EYES[1] - 10} ${EYE_Y - 16}`} stroke="#7DD3FC" strokeWidth={3.5} strokeLinecap="round" />}
    </G>
  );
}
