import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, View, type HostInstance } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { Icon } from '@/components/Icon';
import { Robot } from '@/components/Robot';
import { Legend, ScheduleGrid } from '@/components/ScheduleGrid';
import { Btn, Footer, Header, Loading, Screen, Scroll, T } from '@/components/ui';
import { notify } from '@/lib/confirm';
import { useAuth, useUid } from '@/lib/auth-context';
import { useClasses } from '@/lib/db';
import { downloadImage, shareImage } from '@/lib/save-image';
import { C } from '@/theme';

export default function ScheduleImage() {
  const uid = useUid();
  const { profile } = useAuth();
  const { data: classes, loading } = useClasses(uid);
  const card = useRef<HostInstance>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { share: autoShare } = useLocalSearchParams<{ share?: string }>();
  const shared = useRef(false);

  const run = async (fn: (r: typeof card) => Promise<string | null>, label: string) => {
    setBusy(true);
    try {
      const msg = await fn(card);
      if (msg) setToast(msg);
    } catch (e) {
      // The person closing the browser's share sheet is not an error.
      if ((e as Error)?.name !== 'AbortError') notify(`Could not ${label}`, e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const download = () => run(downloadImage, 'save the image');
  const share = () => run(shareImage, 'share');

  // "Share" on the Schedule tab opens this screen with share=1: share once the image has rendered.
  useEffect(() => {
    if (autoShare !== '1' || loading || !profile || shared.current) return;
    shared.current = true;
    const t = setTimeout(() => share(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoShare, loading, profile]);

  if (loading || !profile) return <Loading />;

  const name = [profile.firstName, profile.lastName].join(' ');

  return (
    <Screen>
      <Header title="Your schedule is ready!" sub="Save it or share it" onBack={() => router.replace('/schedule')} />
      <Scroll pad={false} style={{ paddingHorizontal: 16 }}>
        {/* Everything inside this view becomes the downloaded PNG. */}
        <View ref={card} collapsable={false} style={{ backgroundColor: '#fff', borderRadius: 22, padding: 6 }}>
          <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.line }}>
            <View style={{ backgroundColor: C.primary, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Robot size={66} outfit={profile.outfit} still />
              </View>
              <View>
                <T w={900} size={24} color="#fff" style={{ letterSpacing: 1 }}>METAKNOWIA</T>
                <T w={800} size={15} color="#fff">My Schedule</T>
                <View style={{ width: 40, height: 4, borderRadius: 99, backgroundColor: '#FDE68A', marginVertical: 3 }} />
                <T w={700} size={11} color="#DBEAFE">{name} · {profile.gradeLevel}</T>
              </View>
            </View>
            <ScheduleGrid classes={classes} />
            <View style={{ padding: 8, paddingBottom: 4, backgroundColor: '#fff' }}>
              <Legend classes={classes} />
            </View>
            <T w={700} size={8} color="#475569" style={{ textAlign: 'center', padding: 6, backgroundColor: '#F8FAFC' }}>Made with METAKNOWIA · AI study buddy</T>
          </View>
        </View>
      </Scroll>
      <Footer>
        <Btn icon="download" title="Download image" onPress={download} loading={busy} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Btn icon="share" variant="ghost" title="Share" style={{ flex: 1 }} onPress={share} />
          <Btn variant="ghost" title="Open in app" style={{ flex: 1 }} onPress={() => router.replace('/schedule')} />
        </View>
      </Footer>

      {toast && (
        <Animated.View entering={FadeInDown} exiting={FadeOutDown} accessibilityLiveRegion="polite"
          style={{ position: 'absolute', left: 20, right: 20, bottom: Platform.OS === 'ios' ? 190 : 170, backgroundColor: '#14532D', borderRadius: 16, paddingVertical: 12, paddingLeft: 16, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="check" color="#fff" strokeWidth={2.6} />
          <T w={800} color="#fff" style={{ flex: 1 }}>{toast}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setToast(null)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 10 }}>
            <T w={800} color="#BBF7D0">OK</T>
          </Pressable>
        </Animated.View>
      )}
    </Screen>
  );
}
