import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { enumCorrect, matches, typeOf, underlineParts } from '@/lib/question-types';
import type { Question } from '@/lib/types';
import { C, F } from '@/theme';

import { Icon } from './Icon';
import { Btn, T } from './ui';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/**
 * onAnswer(points, picked): points earned (a matching set gives 1 per correct pair, everything else 0 or 1);
 * picked is the chosen option for choice questions (-1 = time ran out).
 * Render with key={question.id} so each question starts fresh.
 */
type Props = { q: Question; answered: boolean; picked: number | null; onAnswer: (points: number, picked?: number) => void };

/** The question text. Fill in the blanks shows a line; modified true/false underlines the key word. */
export function QuestionPrompt({ q }: { q: Question }) {
  const style = { marginTop: 12, marginBottom: 18, lineHeight: 28 };
  if (typeOf(q) === 'mtf')
    return (
      <T w={900} size={21} style={style}>
        {underlineParts(q.prompt).map((p, i) => (p.underline ? <T key={i} w={900} size={21} color={C.primary700} style={{ textDecorationLine: 'underline' }}>{p.text}</T> : p.text))}
      </T>
    );
  return <T w={900} size={21} style={style}>{typeOf(q) === 'fill' ? q.prompt.replace('____', '________') : q.prompt}</T>;
}

export function AnswerArea(props: Props) {
  switch (typeOf(props.q)) {
    case 'fill':
    case 'id':
      return <TypeIn {...props} />;
    case 'mtf':
      return <ModifiedTrueFalse {...props} />;
    case 'enum':
      return <Enumeration {...props} />;
    case 'match':
      return <Matching {...props} />;
    case 'seq':
      return <Sequencing {...props} />;
    default:
      return <Choices {...props} />;
  }
}

// ------------------------------------------------------------------ multiple choice, true or false
function Choices({ q, answered, picked, onAnswer }: Props) {
  const tf = typeOf(q) === 'tf';
  return (
    <View style={{ gap: 12, flexDirection: tf ? 'row' : 'column' }}>
      {q.choices.map((choice, i) => (
        <Option key={i} label={tf ? choice : `Answer ${KEYS[i]}: ${choice}`} keyText={tf ? (i === 0 ? 'T' : 'F') : KEYS[i]} text={choice}
          state={!answered ? 'idle' : i === q.answerIndex ? 'right' : i === picked ? 'wrong' : 'faded'} selected={picked === i}
          onPress={() => onAnswer(i === q.answerIndex ? 1 : 0, i)} disabled={answered} style={tf ? { flex: 1 } : undefined} />
      ))}
    </View>
  );
}

type OptState = 'idle' | 'right' | 'wrong' | 'faded' | 'on';
function Option({ keyText, text, label, state, selected, onPress, disabled, style }: { keyText: string; text: string; label: string; state: OptState; selected?: boolean; onPress: () => void; disabled?: boolean; style?: object }) {
  const right = state === 'right';
  const wrong = state === 'wrong';
  const on = state === 'on';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 62, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderWidth: 2, borderBottomWidth: pressed && !disabled ? 2 : 5,
        backgroundColor: right ? C.success50 : wrong ? C.danger50 : on ? C.primary50 : C.surface,
        borderColor: right ? '#22C55E' : wrong ? C.danger : on ? C.primary : C.line,
        borderBottomColor: right ? '#86EFAC' : wrong ? '#FCA5A5' : on ? C.primary : C.line,
        opacity: state === 'faded' ? 0.45 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }],
      }, style]}>
      <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: right ? '#22C55E' : wrong ? C.danger : on ? C.primary : C.chip }}>
        <T w={900} color={right || wrong || on ? '#fff' : C.ink2}>{keyText}</T>
      </View>
      <T w={800} size={16} style={{ flex: 1 }}>{text}</T>
      {right && <Icon name="check" color={C.success} strokeWidth={3} />}
      {wrong && <Icon name="x" color={C.danger} strokeWidth={3} />}
    </Pressable>
  );
}

// ------------------------------------------------------------------ typed answers
function AnswerInput({ value, onChange, placeholder, done, ok, label, onSubmit }: { value: string; onChange: (v: string) => void; placeholder: string; done: boolean; ok?: boolean; label: string; onSubmit?: () => void }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.faint} editable={!done} accessibilityLabel={label}
      autoCapitalize="none" autoCorrect={false} returnKeyType="done" onSubmitEditing={onSubmit}
      style={{ minHeight: 56, borderRadius: 16, borderWidth: 2, paddingHorizontal: 16, fontFamily: F.bold, fontSize: 17, color: C.ink,
        borderColor: !done ? C.primary : ok ? '#22C55E' : C.danger, backgroundColor: !done ? C.surface : ok ? C.success50 : C.danger50 }} />
  );
}

function TypeIn({ q, answered, onAnswer }: Props) {
  const [text, setText] = useState('');
  const [ok, setOk] = useState(false);
  const check = () => {
    if (!text.trim() || answered) return;
    const right = matches(text, q.answers ?? []);
    setOk(right);
    onAnswer(right ? 1 : 0);
  };
  return (
    <View style={{ gap: 12 }}>
      <AnswerInput value={text} onChange={setText} placeholder="Type your answer" done={answered} ok={ok} label="Your answer" onSubmit={check} />
      {!answered && <Btn title="Check" onPress={check} disabled={!text.trim()} />}
      {!answered && <T w={600} size={12.5} color={C.muted} style={{ textAlign: 'center' }}>Small typos and capital letters are OK.</T>}
    </View>
  );
}

function ModifiedTrueFalse({ q, answered, picked, onAnswer }: Props) {
  const [choice, setChoice] = useState<number | null>(null);
  const [word, setWord] = useState('');
  const [ok, setOk] = useState(false);
  const pick = (i: number) => {
    if (answered) return;
    setChoice(i);
    // "True" is final right away; "False" asks for the word that makes it true.
    if (i === 0) {
      const right = q.answerIndex === 0;
      setOk(right);
      onAnswer(right ? 1 : 0, 0);
    }
  };
  const check = () => {
    if (!word.trim() || answered) return;
    const right = q.answerIndex === 1 && matches(word, q.answers ?? []);
    setOk(right);
    onAnswer(right ? 1 : 0, 1);
  };
  const shown = answered ? picked : choice;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {['True', 'False'].map((label, i) => (
          <Option key={label} keyText={i === 0 ? 'T' : 'F'} text={label} label={label} selected={shown === i} disabled={answered}
            state={answered ? (i === q.answerIndex ? 'right' : i === picked ? 'wrong' : 'faded') : choice === i ? 'on' : 'idle'}
            onPress={() => pick(i)} style={{ flex: 1 }} />
        ))}
      </View>
      {choice === 1 && (
        <>
          <T w={800} size={14} color={C.ink2}>It’s false. Type the word that makes it true:</T>
          <AnswerInput value={word} onChange={setWord} placeholder="Correct word" done={answered} ok={ok} label="Word that makes it true" onSubmit={check} />
          {!answered && <Btn title="Check" onPress={check} disabled={!word.trim()} />}
        </>
      )}
    </View>
  );
}

function Enumeration({ q, answered, onAnswer }: Props) {
  const need = q.answers?.length ?? 0;
  const [items, setItems] = useState<string[]>(() => Array(need).fill(''));
  const [ok, setOk] = useState(false);
  const filled = items.filter((s) => s.trim()).length;
  const check = () => {
    if (answered) return;
    const right = enumCorrect(items.filter((s) => s.trim()), q.answers ?? []);
    setOk(right);
    onAnswer(right ? 1 : 0);
  };
  return (
    <View style={{ gap: 10 }}>
      <T w={700} size={13} color={C.muted}>Any order. {filled} of {need} filled.</T>
      {items.map((v, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T w={900} size={16} color={C.muted} style={{ width: 22, textAlign: 'right' }}>{i + 1}.</T>
          <View style={{ flex: 1 }}>
            <AnswerInput value={v} onChange={(t) => setItems((l) => l.map((x, j) => (j === i ? t : x)))} placeholder={`Answer ${i + 1}`} done={answered} ok={ok} label={`Answer ${i + 1} of ${need}`} />
          </View>
        </View>
      ))}
      {!answered && <Btn title="Check" onPress={check} disabled={filled < need} />}
    </View>
  );
}

// ------------------------------------------------------------------ matching
function Matching({ q, answered, onAnswer }: Props) {
  const pairs = q.pairs ?? [];
  // Right-hand column in a fixed shuffled order (stable for this question).
  const [order] = useState(() => pairs.map((_, i) => i).sort(() => Math.random() - 0.5));
  const [chosen, setChosen] = useState<Record<number, number>>({}); // left index → right index
  const [active, setActive] = useState<number | null>(0);
  const done = Object.keys(chosen).length === pairs.length;

  const pickRight = (r: number) => {
    if (answered || active === null) return;
    const next = Object.fromEntries(Object.entries(chosen).filter(([, v]) => v !== r)) as Record<number, number>;
    next[active] = r;
    setChosen(next);
    // Jump to the next left item without a match.
    const free = pairs.findIndex((_, i) => next[i] === undefined);
    setActive(free === -1 ? null : free);
  };
  const check = () => onAnswer(pairs.reduce((n, _, i) => n + (chosen[i] === i ? 1 : 0), 0));

  return (
    <View style={{ gap: 10 }}>
      <T w={700} size={13} color={C.muted}>Tap an item, then tap its match below.</T>
      {pairs.map((p, i) => {
        const r = chosen[i];
        const right = answered && r === i;
        return (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={`${p.left}${r !== undefined ? `, matched with ${KEYS[order.indexOf(r)]}` : ''}`} disabled={answered} onPress={() => setActive(i)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16, borderWidth: 2,
              borderColor: answered ? (right ? '#22C55E' : C.danger) : active === i ? C.primary : C.line,
              backgroundColor: answered ? (right ? C.success50 : C.danger50) : active === i ? C.primary50 : C.surface }}>
            <T w={900} color={C.muted}>{i + 1}.</T>
            <T w={800} size={15} style={{ flex: 1 }}>{p.left}</T>
            <View style={{ minWidth: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: r === undefined ? C.chip : C.primary }}>
              <T w={900} color={r === undefined ? C.faint : '#fff'}>{r === undefined ? '?' : KEYS[order.indexOf(r)]}</T>
            </View>
          </Pressable>
        );
      })}
      <View style={{ height: 2, backgroundColor: C.line, marginVertical: 4 }} />
      {order.map((r, k) => {
        const usedBy = Object.entries(chosen).find(([, v]) => v === r)?.[0];
        return (
          <Pressable key={r} accessibilityRole="button" accessibilityLabel={`${KEYS[k]}: ${pairs[r].right}`} disabled={answered || active === null} onPress={() => pickRight(r)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 2, borderColor: C.line, backgroundColor: usedBy !== undefined ? '#F8FAFC' : C.surface }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary100 }}>
              <T w={900} color={C.primary700}>{KEYS[k]}</T>
            </View>
            <T w={700} size={14.5} style={{ flex: 1 }}>{pairs[r].right}</T>
            {usedBy !== undefined && <T w={800} size={12} color={C.muted}>→ {Number(usedBy) + 1}</T>}
          </Pressable>
        );
      })}
      {!answered && <Btn title="Check" onPress={check} disabled={!done} />}
    </View>
  );
}

// ------------------------------------------------------------------ sequencing
function Sequencing({ q, answered, onAnswer }: Props) {
  const items = q.items ?? [];
  const [order, setOrder] = useState(() => {
    let o = items.map((_, i) => i);
    // Shuffle, but never start already in the right order.
    for (let t = 0; t < 5 && o.every((v, i) => v === i); t++) o = [...o].sort(() => Math.random() - 0.5);
    return o;
  });
  const move = (from: number, by: number) => {
    const to = from + by;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    setOrder(next);
  };
  return (
    <View style={{ gap: 8 }}>
      <T w={700} size={13} color={C.muted}>Use the arrows to put them in the right order (first at the top).</T>
      {order.map((it, pos) => {
        const right = answered && it === pos;
        return (
          <View key={it} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 2,
            borderColor: answered ? (right ? '#22C55E' : C.danger) : C.line, backgroundColor: answered ? (right ? C.success50 : C.danger50) : C.surface }}>
            <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary }}>
              <T w={900} color="#fff">{pos + 1}</T>
            </View>
            <T w={800} size={15} style={{ flex: 1 }}>{items[it]}</T>
            {!answered && (
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Arrow icon="up" label={`Move ${items[it]} up`} onPress={() => move(pos, -1)} disabled={pos === 0} />
                <Arrow icon="down" label={`Move ${items[it]} down`} onPress={() => move(pos, 1)} disabled={pos === order.length - 1} />
              </View>
            )}
          </View>
        );
      })}
      {!answered && <Btn title="Check" onPress={() => onAnswer(order.every((v, i) => v === i) ? 1 : 0)} />}
    </View>
  );
}

function Arrow({ icon, label, onPress, disabled }: { icon: 'up' | 'down'; label: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={4}
      style={{ width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary50, opacity: disabled ? 0.35 : 1 }}>
      <Icon name={icon} size={18} color={C.primary700} strokeWidth={3} />
    </Pressable>
  );
}
