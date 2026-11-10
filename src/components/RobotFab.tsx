import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { Outfit } from '@/lib/types';
import { C } from '@/theme';

import { Robot, type RobotHandle } from './Robot';
import { T } from './ui';

/**
 * Floating METANOIA on Home: just the robot, no pill.
 * Phones have no hover, so the "Ask METANOIA" label shows for a few seconds when Home opens
 * and again on long-press. Tap opens the chat.
 */
export function RobotFab({ outfit }: { outfit: Outfit }) {
  const [tip, setTip] = useState(true);
  const robot = useRef<RobotHandle>(null);

  useEffect(() => {
    const t = setTimeout(() => setTip(false), 3500);
    return () => clearTimeout(t);
  }, []);

  const showTip = () => {
    setTip(true);
    robot.current?.play('wave');
    setTimeout(() => setTip(false), 2500);
  };

  return (
    <View style={st.wrap} pointerEvents="box-none">
      {tip && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(200)} style={st.tip} pointerEvents="none">
          <T w={900} size={14} color="#fff" style={{ lineHeight: 17 }}>Ask METANOIA</T>
          <T w={700} size={11.5} color="#BFDBFE" style={{ lineHeight: 14 }}>AI study buddy</T>
          <View style={st.arrow} />
        </Animated.View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask METANOIA, your AI study buddy"
        accessibilityHint="Opens the chat. Long-press to see the label."
        onPress={() => router.navigate('/chat')}
        onLongPress={showTip}
        style={({ pressed }) => [st.btn, pressed && { transform: [{ scale: 0.94 }] }]}>
        <Robot ref={robot} size={70} outfit={outfit} intro="wave" idleGesture="wave" idleEvery={8000} />
        <View style={st.shadow} />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center' },
  btn: { width: 78, height: 82, alignItems: 'center', justifyContent: 'center' },
  shadow: { position: 'absolute', bottom: 2, width: 46, height: 8, borderRadius: 23, backgroundColor: 'rgba(30,58,138,.18)', zIndex: -1 },
  tip: { backgroundColor: C.navy, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12, marginRight: 4 },
  arrow: { position: 'absolute', right: -7, top: '50%', marginTop: 1, width: 0, height: 0, borderTopWidth: 7, borderBottomWidth: 7, borderLeftWidth: 7, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: C.navy },
});
