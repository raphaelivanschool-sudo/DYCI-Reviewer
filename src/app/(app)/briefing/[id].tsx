import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Btn, Card, Footer, Header, Loading, Screen, Scroll, T, Toggle } from '@/components/ui';
import { useUid } from '@/lib/auth-context';
import { useFolders, useReviewer } from '@/lib/db';
import { XP } from '@/lib/game';
import { tr, useLang } from '@/lib/lang';
import { C, tintOf } from '@/theme';

const PRESETS = [10, 30, 60];
const PREFS_KEY = 'metanoia_quiz_prefs';
type Prefs = { timerOn: boolean; seconds: number; shuffle: boolean };

/** "Stage briefing" before a reviewer: shows what's at stake and lets the student pick a timer. */
export default function Briefing() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const lang = useLang();
  const { reviewer, loading } = useReviewer(uid, id);
  const folder = useFolders(uid).data.find((f) => f.id === reviewer?.folderId);
  const [prefs, setPrefs] = useState<Prefs>({ timerOn: false, seconds: 30, shuffle: false });
  const [custom, setCustom] = useState(false);

  // Remember the last timer choice on this phone.
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as Prefs;
        setPrefs(p);
        setCustom(!PRESETS.includes(p.seconds));
      })
      .catch(() => {});
  }, []);
  const update = (p: Partial<Prefs>) => {
    const next = { ...prefs, ...p };
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
  };

  if (loading) return <Loading />;
  if (!reviewer) return <Screen><Header title="Stage not found" /></Screen>;

  const count = reviewer.questionCount;
  const resumable = reviewer.answered > 0 && reviewer.answered < count;
  const maxXp = count * (XP.correct + XP.comboBonus * 3) + (prefs.timerOn ? count * XP.fastBonus : 0);
  const totalMin = Math.max(1, Math.round((count * prefs.seconds) / 60));
  const color = folder ? tintOf(folder.tint).fg : C.navy;

  const start = (restart: boolean) =>
    router.replace({
      pathname: '/quiz/[id]',
      params: { id: reviewer.id, timer: prefs.timerOn ? String(prefs.seconds) : '0', shuffle: prefs.shuffle ? '1' : '0', restart: restart ? '1' : '0' },
    });

  return (
    <Screen>
      <Header title={reviewer.title} kicker={`${folder?.name ?? 'No subject'} · ${reviewer.difficulty}`} color={color}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 12 }}>
          <Robot size={86} intro="cheer" mood="excited" />
          <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 12, borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.15)' }}>
            <T w={800} size={14.5}>{resumable
              ? tr(lang, `Let’s continue! You’re on question ${reviewer.answered + 1}.`, `Tuloy natin! Nasa question ${reviewer.answered + 1} ka na.`)
              : tr(lang, 'You’ve got this! I’m ready when you are.', 'Kaya mo ’to! Ready na ako pag ready ka na.')}</T>
          </View>
        </View>
      </Header>
      <Scroll>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
          <Stat value={String(count)} label="questions" />
          <Stat value={reviewer.bestPercent === null ? '–' : `${reviewer.bestPercent}%`} label="best score" />
          <Stat value={`+${maxXp}`} label="max XP" color="#B45309" />
        </View>

        <Card style={{ gap: 12 }}>
          <Row icon="zap" title="Timer per question" sub="Answer before time runs out" right={<Toggle label="Timer per question" value={prefs.timerOn} onChange={(v) => update({ timerOn: v })} />} />
          {prefs.timerOn && (
            <>
              <T w={800} size={13.5} color={C.ink2}>Seconds per question</T>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {PRESETS.map((n) => (
                  <Seg key={n} label={`${n}s`} on={!custom && prefs.seconds === n} onPress={() => { setCustom(false); update({ seconds: n }); }} />
                ))}
                <Seg label="Custom" on={custom} onPress={() => setCustom(true)} />
              </View>
              {custom && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <StepBtn icon="minus" label="Less time" onPress={() => update({ seconds: Math.max(5, prefs.seconds - 5) })} />
                  <View style={{ flex: 1, alignItems: 'center' }} accessibilityLiveRegion="polite">
                    <T w={900} size={30} color={C.navy}>{prefs.seconds} <T w={800} size={16} color={C.muted}>sec</T></T>
                  </View>
                  <StepBtn icon="plus" label="More time" onPress={() => update({ seconds: Math.min(300, prefs.seconds + 5) })} />
                </View>
              )}
              <T w={700} size={12.5} color={C.muted} style={{ textAlign: 'center' }}>
                Total: about {totalMin} min · Answer within {Math.max(1, Math.round(prefs.seconds / 3))}s for +{XP.fastBonus} bonus XP
              </T>
            </>
          )}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Row icon="shuffle" title="Shuffle questions" sub="Different order every try" right={<Toggle label="Shuffle questions" value={prefs.shuffle} onChange={(v) => update({ shuffle: v })} />} />
        </Card>
      </Scroll>
      <Footer>
        {resumable ? (
          <View style={{ gap: 10 }}>
            <Btn title={`Continue · Q${reviewer.answered + 1} of ${count}`} variant="success" icon="play" onPress={() => start(false)} />
            <Btn title="Start over" variant="ghost" small onPress={() => start(true)} />
          </View>
        ) : (
          <Btn title="Start stage" variant="success" icon="play" onPress={() => start(true)} />
        )}
      </Footer>
    </Screen>
  );
}

function Stat({ value, label, color = C.ink }: { value: string; label: string; color?: string }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6 }}>
      <T w={900} size={20} color={color}>{value}</T>
      <T w={800} size={12} color={C.muted}>{label}</T>
    </Card>
  );
}

function Row({ icon, title, sub, right }: { icon: IconName; title: string; sub: string; right: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.primary100, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} color={C.primary700} /></View>
      <View style={{ flex: 1 }}>
        <T w={800} size={16}>{title}</T>
        <T w={600} size={13} color={C.muted}>{sub}</T>
      </View>
      {right}
    </View>
  );
}

function Seg({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ flex: 1, height: 44, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, alignItems: 'center', justifyContent: 'center', borderColor: on ? C.primary : C.line, backgroundColor: on ? C.primary50 : '#fff' }}>
      <T w={900} size={14.5} color={on ? C.primary700 : C.ink2}>{label}</T>
    </Pressable>
  );
}

function StepBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.primary100, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: '#93C5FD' }}>
      <Icon name={icon} size={24} color={C.primary700} strokeWidth={3} />
    </Pressable>
  );
}
