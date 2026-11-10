import { Alert, Platform } from 'react-native';

/** Yes/No question that works on phones (native alert) and in the web preview (browser confirm). */
export function confirmAction(title: string, message: string | undefined, okText: string, onOk: () => void, destructive = true) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.([title, message].filter(Boolean).join('\n\n'))) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: okText, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}

/** One-button message that also shows in the web preview (React Native Web's Alert does nothing). */
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.([title, message].filter(Boolean).join('\n\n'));
    return;
  }
  Alert.alert(title, message);
}
