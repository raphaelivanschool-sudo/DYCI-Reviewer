import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { C } from '@/theme';

import { T } from './ui';

export function Ring({ value, size = 96, stroke = 10, label, big }: { value: number | null; size?: number; stroke?: number; label?: string; big?: boolean }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value ?? 0));
  const color = value === null ? C.line : v >= 75 ? C.success : v >= 50 ? C.warning : C.danger;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={value === null ? 'No score yet' : `${v} percent`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${(circ * v) / 100} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
        <T w={900} size={big ? 36 : 18}>{value === null ? '–' : `${v}%`}</T>
        {label ? <T w={700} size={13} color={C.muted}>{label}</T> : null}
      </View>
    </View>
  );
}
