import { Pressable, StyleSheet, View } from 'react-native';

import { DAY_SHORT, fmtTime, gridDays, gridHours, toDay } from '@/lib/schedule';
import type { ClassItem } from '@/lib/types';
import { C } from '@/theme';

import { T } from './ui';

const ROW = 36;

type Props = {
  classes: (Omit<ClassItem, 'id'> & { id?: string })[];
  /** Live view: tints today's column and outlines the next class. */
  live?: boolean;
  nextId?: string | null;
  onPressClass?: (c: ClassItem) => void;
};

/** Weekly timetable. Columns stretch to the available width. */
export function ScheduleGrid({ classes, live, nextId, onPressClass }: Props) {
  const { start, end } = gridHours(classes);
  const days = gridDays(classes);
  const today = toDay(new Date());
  const height = (end - start) * ROW;
  const hours = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <View style={st.wrap} accessibilityLabel={`Weekly class schedule, ${DAY_SHORT[days[0]]} to ${DAY_SHORT[days[days.length - 1]]}`}>
      <View style={[st.head]}>
        <View style={st.gutter} />
        {days.map((d) => (
          <View key={d} style={[st.dayHead, live && d === today && { backgroundColor: C.navy }]}>
            <T w={900} size={11} color="#fff">{DAY_SHORT[d]}</T>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={[st.gutter, { height, backgroundColor: '#F8FAFC' }]}>
          {hours.map((h, i) => (
            <T key={h} w={800} size={8} color="#475569" style={{ position: 'absolute', top: i * ROW + 2, right: 3, lineHeight: 10 }}>
              {`${((h + 11) % 12) + 1}${h < 12 ? 'AM' : 'PM'}`}
            </T>
          ))}
        </View>
        {days.map((d) => (
          <View key={d} style={[st.col, { height }, live && d === today && { backgroundColor: '#FFFBEB' }]}>
            {hours.map((h, i) => (
              <View key={h} style={[st.line, { top: (i + 1) * ROW - 1 }]} />
            ))}
            {classes
              .filter((c) => c.day === d)
              .map((c, i) => {
                const isNext = live && !!nextId && c.id === nextId;
                const body = (
                  <>
                    <T w={900} size={9} color="#fff" style={{ lineHeight: 11 }}>{c.code}</T>
                    <T w={700} size={7} color="#fff" style={{ lineHeight: 9 }}>{`${fmtTime(c.start, true)}–${fmtTime(c.end, true)}`}</T>
                    {c.room ? <T w={600} size={7} color="#fff" style={{ lineHeight: 9 }}>{c.room}</T> : null}
                  </>
                );
                const blockStyle = [
                  st.block,
                  { top: (c.start - start) * ROW + 1, height: (c.end - c.start) * ROW - 2, backgroundColor: c.color },
                  isNext && st.next,
                ];
                return onPressClass && c.id ? (
                  <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`Edit ${c.subject}, ${DAY_SHORT[c.day]} ${fmtTime(c.start)}`} onPress={() => onPressClass(c as ClassItem)} style={blockStyle}>
                    {body}
                  </Pressable>
                ) : (
                  <View key={c.id ?? `${d}-${i}`} style={blockStyle}>{body}</View>
                );
              })}
          </View>
        ))}
      </View>
    </View>
  );
}

export function Legend({ classes }: { classes: Pick<ClassItem, 'subject' | 'color'>[] }) {
  const seen = new Map<string, string>();
  classes.forEach((c) => seen.set(c.subject, c.color));
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
      {[...seen].map(([subject, color]) => (
        <View key={subject} style={st.legend}>
          <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: color }} />
          <T w={700} size={12}>{subject}</T>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  head: { flexDirection: 'row', backgroundColor: C.primary },
  gutter: { width: 34 },
  dayHead: { flex: 1, height: 30, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.2)' },
  col: { flex: 1, borderLeftWidth: 1, borderLeftColor: C.line },
  line: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#EEF2F7' },
  block: { position: 'absolute', left: 2, right: 2, borderRadius: 6, paddingHorizontal: 3, paddingVertical: 2, overflow: 'hidden' },
  next: { borderWidth: 2.5, borderColor: C.warning },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 6, paddingRight: 10, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line },
});
