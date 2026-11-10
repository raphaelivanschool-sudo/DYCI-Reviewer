import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { GESTURES, OUTFIT_ITEMS, Robot, type RobotHandle } from '@/components/Robot';
import { Card, Grid, Header, LinkText, Screen, Scroll, Section, T } from '@/components/ui';
import type { Gesture } from '@/lib/ai';
import { useAuth, useUid } from '@/lib/auth-context';
import { updateProfileFields, useReviewers } from '@/lib/db';
import { useResponsive } from '@/lib/responsive';
import { DEFAULT_OUTFIT, type Outfit, type OutfitSlot } from '@/lib/types';
import { C, shadow } from '@/theme';

const GESTURE_ICONS: Record<Gesture, IconName> = { wave: 'hand', cheer: 'trophy', nod: 'check', no: 'x', think: 'bulb', dance: 'music', sleep: 'moon' };
const SLOTS: { slot: OutfitSlot; label: string }[] = [
  { slot: 'head', label: 'Head' },
  { slot: 'face', label: 'Face' },
  { slot: 'neck', label: 'Neck' },
];

export default function Buddy() {
  const uid = useUid();
  const { profile } = useAuth();
  const reviewers = useReviewers(uid).data;
  const robot = useRef<RobotHandle>(null);
  const { art } = useResponsive();
  const [line, setLine] = useState(`Hi ${profile?.firstName ?? ''}! Tap me or pick a gesture.`);
  if (!profile) return null;

  const outfit = profile.outfit ?? DEFAULT_OUTFIT;
  const unlock = { streak: profile.stats.streak, perfectScores: profile.stats.perfectScores, reviewers: reviewers.length };

  const play = (g: Gesture | 'random') => {
    const played = robot.current?.play(g);
    const found = GESTURES.find((x) => x.id === played);
    if (found) setLine(found.line);
  };

  // Saved on the user document, so every robot in the app (and on other phones) wears it.
  const wear = (next: Outfit) => updateProfileFields(uid, { outfit: next });

  return (
    <Screen>
      <Header title="My METANOIA" />
      <Scroll>
        <View style={{ backgroundColor: C.primary50, borderRadius: 28, paddingTop: 16, paddingBottom: 12, alignItems: 'center', gap: 4 }}>
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: '#fff', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 16, marginHorizontal: 16, ...shadow }}>
            <T w={800} style={{ textAlign: 'center' }}>{line}</T>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Tap METANOIA to see a random gesture" onPress={() => play('random')} style={{ padding: 6 }}>
            <Robot ref={robot} size={art(180)} outfit={outfit} intro="wave" />
          </Pressable>
          <View style={{ width: 130, height: 12, borderRadius: 65, backgroundColor: 'rgba(30,58,138,.12)', marginTop: -16 }} />
        </View>

        <Section title="Gestures" action={<T w={600} size={13.5} color={C.muted}>Tap to play</T>}>
          <Grid columns={4} gap={8}>
            {[...GESTURES.map((g) => ({ id: g.id as Gesture | 'random', label: g.label, icon: GESTURE_ICONS[g.id] })), { id: 'random' as const, label: 'Surprise', icon: 'shuffle' as IconName }].map((g) => (
              <Pressable key={g.id} accessibilityRole="button" accessibilityLabel={`Gesture: ${g.label}`} onPress={() => play(g.id)}
                style={({ pressed }) => ({ minHeight: 70, borderRadius: 16, borderWidth: 2, borderColor: pressed ? C.primary : C.line, backgroundColor: pressed ? C.primary50 : C.surface, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2 })}>
                <Icon name={g.icon} color={C.primary} />
                <T w={800} size={13} color={C.ink2} numberOfLines={1} style={{ textAlign: 'center' }}>{g.label}</T>
              </Pressable>
            ))}
          </Grid>
        </Section>

        <Section title="Outfit" action={<LinkText title="Reset" onPress={() => wear(DEFAULT_OUTFIT)} />}>
          {SLOTS.map(({ slot, label }) => (
            <View key={slot}>
              <T w={900} size={13} color={C.muted} style={{ textTransform: 'uppercase', letterSpacing: 0.6, marginTop: slot === 'head' ? 0 : 16, marginBottom: 8, marginHorizontal: 2 }}>{label}</T>
              <Grid columns={3} gap={8}>
                {OUTFIT_ITEMS.filter((i) => i.slot === slot).map((item) => {
                  const locked = item.lock ? !item.lock.ok(unlock) : false;
                  const on = outfit[slot] === item.id;
                  const preview: Outfit = { ...DEFAULT_OUTFIT, [slot]: item.id };
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={locked ? `${item.label}, locked. Unlock: ${item.lock?.text}` : item.label}
                      accessibilityState={{ selected: on, disabled: locked }}
                      disabled={locked}
                      onPress={() => wear({ ...outfit, [slot]: item.id })}
                      style={{ minHeight: 116, borderRadius: 16, borderWidth: 2, borderColor: on ? C.primary : C.line, backgroundColor: locked ? '#F8FAFC' : on ? C.primary50 : C.surface, alignItems: 'center', paddingTop: 8, paddingBottom: 10, gap: 4 }}>
                      <View style={{ opacity: locked ? 0.4 : 1 }}>
                        <Robot size={62} outfit={preview} still />
                      </View>
                      <T w={800} size={13.5} color={on ? C.primary700 : C.ink2} numberOfLines={1} style={{ textAlign: 'center' }}>{item.label}</T>
                      {locked && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4 }}>
                          <Icon name="lock" size={12} color={C.muted} />
                          <T w={700} size={11.5} color={C.muted} style={{ textAlign: 'center', flexShrink: 1 }}>{item.lock?.text}</T>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </Grid>
            </View>
          ))}
        </Section>

        <Card style={{ flexDirection: 'row', gap: 12, marginTop: 20, backgroundColor: C.amber50 }}>
          <Icon name="sparkles" color="#B45309" />
          <View style={{ flex: 1 }}>
            <T w={900}>More outfits coming soon</T>
            <T size={14} color="#78350F">Unlock new looks with study streaks and high scores. Your outfit shows everywhere METANOIA appears.</T>
          </View>
        </Card>
      </Scroll>
    </Screen>
  );
}
