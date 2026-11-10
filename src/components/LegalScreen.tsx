import { router } from 'expo-router';
import { View } from 'react-native';

import { LEGAL_UPDATED, type LegalSection } from '@/lib/legal';
import { C } from '@/theme';

import { Btn, Footer, Header, Screen, Scroll, T } from './ui';

/** Reads a long legal text (Terms / Privacy Policy). Back returns to wherever it was opened from. */
export function LegalScreen({ title, sections }: { title: string; sections: LegalSection[] }) {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/signup'));
  return (
    <Screen>
      <Header title={title} sub={`Last updated ${LEGAL_UPDATED}`} onBack={close} />
      <Scroll style={{ paddingTop: 16, gap: 18 }}>
        {sections.map((s) => (
          <View key={s.title} style={{ gap: 6 }}>
            <T w={900} size={16.5}>{s.title}</T>
            {s.body.map((p) => (
              <T key={p} w={600} size={15} color={C.ink2}>{p}</T>
            ))}
          </View>
        ))}
      </Scroll>
      <Footer>
        <Btn title="Close" onPress={close} />
      </Footer>
    </Screen>
  );
}
