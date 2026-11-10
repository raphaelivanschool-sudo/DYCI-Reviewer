import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Robot } from '@/components/Robot';
import { Loading, T } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { isFirebaseConfigured } from '@/lib/firebase';
import { C } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {isFirebaseConfigured ? (
          <AuthProvider>
            <RootStack />
          </AuthProvider>
        ) : (
          <SetupNeeded />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const { user, initializing } = useAuth();
  if (initializing) return <Loading />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

/** Shown until the team adds their Firebase keys to .env, instead of crashing. */
function SetupNeeded() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 }}>
      <Robot size={140} intro="think" />
      <T w={900} size={22} style={{ textAlign: 'center' }}>Connect Firebase first</T>
      <T color={C.muted} style={{ textAlign: 'center' }}>
        Copy .env.example to .env, paste your Firebase web app keys, then restart with “npx expo start -c”.
      </T>
    </View>
  );
}
