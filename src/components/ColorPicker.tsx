import { Pressable } from 'react-native';

import { PALETTE } from '@/theme';

import { Icon } from './Icon';
import { Grid, T } from './ui';

/** Grid of colors to choose from. Works for subjects, classes and exams. */
export function ColorPicker({ value, onChange, label = 'Color' }: { value: string; onChange: (color: string) => void; label?: string }) {
  return (
    <>
      {label ? <T w={800} size={14.5} color="#334155">{label}</T> : null}
      <Grid columns={8} gap={8}>
        {PALETTE.map((col) => {
          const on = value.toLowerCase() === col.toLowerCase();
          return (
            <Pressable key={col} accessibilityRole="button" accessibilityLabel={`Color ${col}`} accessibilityState={{ selected: on }} onPress={() => onChange(col)}
              style={{ aspectRatio: 1, borderRadius: 10, backgroundColor: col, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 3 : 0, borderColor: '#FBBF24' }}>
              {on && <Icon name="check" size={16} color="#fff" strokeWidth={3.2} />}
            </Pressable>
          );
        })}
      </Grid>
    </>
  );
}
