import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';

import { Icon } from '@/components/Icon';
import { Robot, type RobotHandle } from '@/components/Robot';
import { Chip, HeaderDecor, Screen, T } from '@/components/ui';
import { AI_MODE, chatReply } from '@/lib/ai';
import { confirmAction, notify } from '@/lib/confirm';
import { useAuth, useUid } from '@/lib/auth-context';
import { addMessage, clearChat, countQuestionAsked, updateProfileFields, useAttempts, useMessages } from '@/lib/db';
import { langOf, tr, type Lang } from '@/lib/lang';
import { column } from '@/lib/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, shadow } from '@/theme';

const SUGGESTIONS: Record<Lang, string[]> = {
  en: ['Explain my weak topic', 'Quiz me (3 items)', 'Summarize my lesson'],
  tl: ['Ipaliwanag ang weak topic ko', 'Quiz me (3 items)', 'Ibuod ang lesson ko'],
};

export default function Chat() {
  const uid = useUid();
  const { profile } = useAuth();
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const { data: messages } = useMessages(uid);
  const lastAttempt = useAttempts(uid, undefined, 1).data[0];
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const robot = useRef<RobotHandle>(null);
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const handledAsk = useRef<string | undefined>(undefined);
  const lang = langOf(profile);

  // Saved on the profile, so Home's robot lines and the quiz follow the same language.
  const setLang = (l: Lang) => {
    if (l !== lang) updateProfileFields(uid, { language: l }).catch(() => notify('Could not switch language', 'Check your internet connection and try again.'));
  };

  const weakTopic = lastAttempt
    ? Object.entries(lastAttempt.byTopic).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)[0]?.[0]
    : undefined;

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || typing || !profile) return;
    setDraft('');
    setTyping(true);
    robot.current?.play('think');
    try {
      await addMessage(uid, 'user', msg);
      countQuestionAsked(uid).catch(() => {});
      const history = [...messages.map((m) => ({ role: m.role, text: m.text })), { role: 'user' as const, text: msg }].slice(-12);
      const reply = await chatReply(history, { firstName: profile.firstName, weakTopic, lang });
      await addMessage(uid, 'bot', reply.text);
      robot.current?.play(reply.gesture);
    } catch (e) {
      robot.current?.play('no');
      notify('METANOIA could not answer', e instanceof Error ? e.message : 'Check your internet connection and try again.');
    } finally {
      setTyping(false);
    }
  };

  // "Ask METANOIA about X" from the Results screen arrives as a route param.
  useEffect(() => {
    if (ask && ask !== handledAsk.current) {
      handledAsk.current = ask;
      send(ask);
      router.setParams({ ask: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ask]);

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length, typing]);

  const confirmClear = () => confirmAction('Clear this chat?', 'All messages with METANOIA will be deleted.', 'Clear', () => clearChat(uid));

  return (
    <Screen>
      <View style={{ backgroundColor: C.navy, paddingTop: insets.top + 8, paddingBottom: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden', paddingHorizontal: 16, gap: 10 }}>
        <HeaderDecor />
        <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="left" color="#fff" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Tap METANOIA to see a gesture" onPress={() => robot.current?.play('random')} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Robot ref={robot} size={48} outfit={profile?.outfit} intro="wave" mood={typing ? 'happy' : 'excited'} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T w={900} size={19} color="#fff">METANOIA</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' }} />
            <T w={700} size={13} color="#BFDBFE">{typing ? tr(lang, 'Typing…', 'Nagta-type…') : AI_MODE === 'mock' ? 'Practice mode' : 'Online'}</T>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear chat" onPress={confirmClear} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' }}>
          <Icon name="trash" size={20} color="#fff" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Customize METANOIA: outfits and gestures" onPress={() => router.push('/buddy')} style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBBF24' }}>
          <Icon name="shirt" size={20} color="#422006" />
        </Pressable>
        </View>
        <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <T w={800} size={13} color="#BFDBFE">{tr(lang, 'Chat language', 'Wika ng chat')}</T>
          <View accessibilityRole="radiogroup" style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: 3 }}>
            {(['en', 'tl'] as const).map((l) => (
              <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: lang === l }} accessibilityLabel={l === 'en' ? 'English' : 'Tagalog'} onPress={() => setLang(l)}
                style={{ flex: 1, minHeight: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: lang === l ? '#fff' : 'transparent' }}>
                <T w={900} size={13.5} color={lang === l ? C.navy : '#DBEAFE'}>{l === 'en' ? 'English' : 'Tagalog'}</T>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={[column, { padding: 20, gap: 10 }]} keyboardShouldPersistTaps="handled">
          <Bubble role="bot" text={tr(lang,
            `Hi ${profile?.firstName ?? ''}! I'm METANOIA, your study buddy. ${weakTopic ? `I saw your last result: ${lastAttempt?.percent}%. Want help with ${weakTopic}?` : 'Ask me anything about your lessons.'}`,
            `Hi ${profile?.firstName ?? ''}! Ako si METANOIA, ang study buddy mo. ${weakTopic ? `Nakita ko ang huling score mo: ${lastAttempt?.percent}%. Gusto mo ng tulong sa ${weakTopic}?` : 'Itanong mo lang sa akin kahit ano tungkol sa lessons mo.'}`)} />
          {messages.map((m) => <Bubble key={m.id} role={m.role} text={m.text} />)}
          {typing && <Bubble role="bot" text="…" />}
          {!typing && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {SUGGESTIONS[lang].map((s) => (
                <Chip key={s} title={s} onPress={() => send(s)} style={{ minHeight: 40, backgroundColor: C.primary50, borderColor: '#BFDBFE' }} />
              ))}
            </View>
          )}
        </ScrollView>
        <View style={{ backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line }}>
        <View style={[column, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={tr(lang, 'Ask about your lessons…', 'Magtanong tungkol sa lessons mo…')}
            placeholderTextColor={C.faint}
            accessibilityLabel="Message METANOIA"
            onSubmitEditing={() => send(draft)}
            returnKeyType="send"
            style={{ flex: 1, minHeight: 46, borderRadius: 99, backgroundColor: '#F1F5F9', paddingHorizontal: 16, fontFamily: F.semibold, fontSize: 15, color: C.ink }}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send(draft)} disabled={!draft.trim() || typing} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: draft.trim() ? C.primary : '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="send" size={20} color="#fff" />
          </Pressable>
        </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ role, text }: { role: 'user' | 'bot'; text: string }) {
  const me = role === 'user';
  return (
    <View style={[{ maxWidth: '84%', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 20 }, me ? { alignSelf: 'flex-end', backgroundColor: C.primary, borderBottomRightRadius: 6 } : { alignSelf: 'flex-start', backgroundColor: C.surface, borderBottomLeftRadius: 6, ...shadow }]}>
      <T size={15.5} color={me ? '#fff' : C.ink}>{text}</T>
    </View>
  );
}
