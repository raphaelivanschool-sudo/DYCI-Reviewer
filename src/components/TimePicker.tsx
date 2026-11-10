import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { fmtTime } from '@/lib/schedule';
import { C } from '@/theme';

import { Icon } from './Icon';
import { Btn, Chip, Sheet, T } from './ui';

/** Bottom sheet to choose a time of day. value/onSave use hours (19.5 = 7:30 PM). */
export function TimePicker({ visible, value, title, presets = [], onClose, onSave }: {
  visible: boolean;
  value: number;
  title: string;
  /** Quick choices shown as chips, in hours. */
  presets?: number[];
  onClose: () => void;
  onSave: (hours: number) => void;
}) {
  const [t, setT] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setT(value);
  }

  const h24 = Math.floor(t);
  const min = Math.round((t - h24) * 60);
  const pm = h24 >= 12;
  const h12 = ((h24 + 11) % 12) + 1;
  const set = (hour24: number, minute: number) => setT((((hour24 % 24) + 24) % 24) + minute / 60);
  const stepHour = (d: number) => set(h24 + d, min);
  const stepMin = (d: number) => {
    const total = (h24 * 60 + min + d + 24 * 60) % (24 * 60);
    set(Math.floor(total / 60), total % 60);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={title} footer={<Btn title={`Set ${fmtTime(t)}`} onPress={() => onSave(t)} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 6 }}>
        <Wheel label="Hour" value={String(h12)} onUp={() => stepHour(1)} onDown={() => stepHour(-1)} />
        <T w={900} size={40} style={{ lineHeight: 48 }}>:</T>
        <Wheel label="Minutes" value={String(min).padStart(2, '0')} onUp={() => stepMin(5)} onDown={() => stepMin(-5)} />
        <View style={{ gap: 8, marginLeft: 6 }}>
          {(['AM', 'PM'] as const).map((p) => {
            const on = (p === 'PM') === pm;
            return (
              <Pressable key={p} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => !on && set(h24 + (p === 'PM' ? 12 : -12), min)}
                style={{ width: 64, height: 46, borderRadius: 14, borderWidth: 2, borderColor: on ? C.primary : C.line, backgroundColor: on ? C.primary50 : C.surface, alignItems: 'center', justifyContent: 'center' }}>
                <T w={900} size={16} color={on ? C.primary700 : C.muted}>{p}</T>
              </Pressable>
            );
          })}
        </View>
      </View>
      {presets.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {presets.map((p) => <Chip key={p} title={fmtTime(p)} on={Math.abs(p - t) < 0.01} onPress={() => setT(p)} style={{ minHeight: 38, paddingHorizontal: 12 }} />)}
        </View>
      )}
    </Sheet>
  );
}

function Wheel({ label, value, onUp, onDown }: { label: string; value: string; onUp: () => void; onDown: () => void }) {
  const btn = { width: 76, height: 40, borderRadius: 12, backgroundColor: C.primary50, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ alignItems: 'center', gap: 6 }} accessibilityLabel={`${label}: ${value}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} up`} onPress={onUp} style={({ pressed }) => [btn, pressed && { opacity: 0.6 }]}>
        <Icon name="up" size={22} color={C.primary700} strokeWidth={3} />
      </Pressable>
      <View style={{ width: 76, height: 64, borderRadius: 16, borderWidth: 2, borderColor: C.primary, alignItems: 'center', justifyContent: 'center' }}>
        <T w={900} size={34} style={{ lineHeight: 42 }}>{value}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label} down`} onPress={onDown} style={({ pressed }) => [btn, pressed && { opacity: 0.6 }]}>
        <Icon name="down" size={22} color={C.primary700} strokeWidth={3} />
      </Pressable>
    </View>
  );
}
