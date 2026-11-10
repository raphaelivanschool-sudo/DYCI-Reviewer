import { Pressable, View } from 'react-native';

import { C } from '@/theme';

import { Icon } from './Icon';
import { T } from './ui';

export const PIN_LENGTH = 4;

export function PinDots({ value, error }: { value: string; error?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 16, justifyContent: 'center' }} accessibilityLabel={`${value.length} of ${PIN_LENGTH} digits entered`}>
      {Array.from({ length: PIN_LENGTH }, (_, i) => (
        <View key={i} style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: error ? '#FCA5A5' : i < value.length ? '#FBBF24' : '#93C5FD', backgroundColor: i < value.length ? (error ? '#F87171' : '#FBBF24') : 'transparent' }} />
      ))}
    </View>
  );
}

/** Number pad for PINs. `onBiometrics` adds a fingerprint key in the bottom-left. */
export function Keypad({ value, onChange, onBiometrics }: { value: string; onChange: (v: string) => void; onBiometrics?: () => void }) {
  const press = (k: string) => {
    if (k === 'del') onChange(value.slice(0, -1));
    else if (value.length < PIN_LENGTH) onChange(value + k);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 26, justifyContent: 'center' }}>
      {keys.map((k) => {
        if (k === 'bio' && !onBiometrics) return <View key={k} style={{ width: '29%', height: 62 }} />;
        const label = k === 'del' ? 'Delete' : k === 'bio' ? 'Use fingerprint' : k;
        return (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={label} onPress={() => (k === 'bio' ? onBiometrics?.() : press(k))}
            style={({ pressed }) => ({ width: '29%', height: 62, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderBottomWidth: pressed ? 1 : 4, borderBottomColor: C.line, transform: [{ translateY: pressed ? 3 : 0 }] })}>
            {k === 'del' ? <Icon name="backspace" size={28} color={C.ink2} /> : k === 'bio' ? <Icon name="finger" size={30} color={C.primary} /> : <T w={900} size={26}>{k}</T>}
          </Pressable>
        );
      })}
    </View>
  );
}
