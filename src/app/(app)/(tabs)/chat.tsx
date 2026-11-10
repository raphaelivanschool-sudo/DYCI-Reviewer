import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type ScrollViewInstance } from 'react-native';

import { Icon } from '@/components/Icon';
import { Robot, type RobotHandle } from '@/components/Robot';
import { Chip, IconBtn, Screen, T } from '@/components/ui';
import { AI_MODE, chatReply } from '@/lib/ai';
import { confirmAction } from '@/lib/confirm';
import { useAuth, useUid } from '@/lib/auth-context';
import { addMessage, clearChat, useAttempts, useMessages } from '@/lib/db';
import { C, F, shadow } from '@/theme';

const SUGGESTIONS = ['Explain my weak topic', 'Quiz me (3 items)', 'Summarize my lesson'];

export default function Chat() {
  const uid = useUid();
  const { profile } = useAuth();
  const { ask } = useLocalSearchParams<{ ask?: string }>();
  const { data: messages } = useMessages(uid);
  const lastAttempt = useAttempts(uid, undefined, 1).data[0];
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const robot = useRef<RobotHandle>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const handledAsk = useRef<string | undefined>(undefined);

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
      const history = [...messages.map((m) => ({ role: m.role, text: m.text })), { role: 'user' as const, text: msg }].slice(-12);
      const reply = await chatReply(history, { firstName: profile.firstName, weakTopic });
      await addMessage(uid, 'bot', reply.text);
      robot.current?.play(reply.gesture);
    } catch {
      Alert.alert('METANOIA could not answer', 'Check your internet connection and try again.');
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.line }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tap METANOIA to see a gesture" onPress={() => robot.current?.play('random')} style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.primary100, alignItems: 'center', justifyContent: 'center' }}>
          <Robot ref={robot} size={46} outfit={profile?.outfit} intro="wave" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T w={900} size={19}>METANOIA</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.success }} />
            <T w={600} size={13.5} color={C.muted}>{typing ? 'Typing…' : AI_MODE === 'mock' ? 'Practice mode' : 'Online'}</T>
          </View>
        </View>
        <IconBtn icon="trash" flat label="Clear chat" onPress={confirmClear} />
        <IconBtn icon="shirt" label="Customize METANOIA: outfits and gestures" onPress={() => router.push('/buddy')} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Bubble role="bot" text={`Hi ${profile?.firstName ?? ''}! I'm METANOIA, your study buddy. ${weakTopic ? `I saw your last result: ${lastAttempt?.percent}%. Want help with ${weakTopic}?` : 'Ask me anything about your lessons.'}`} />
          {messages.map((m) => <Bubble key={m.id} role={m.role} text={m.text} />)}
          {typing && <Bubble role="bot" text="…" />}
          {!typing && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} title={s} onPress={() => send(s)} style={{ minHeight: 40, backgroundColor: C.primary50, borderColor: '#BFDBFE' }} />
              ))}
            </View>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about your lessons…"
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
