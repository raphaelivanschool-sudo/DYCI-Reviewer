import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { T } from '@/components/ui';
import { C } from '@/theme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Home', icon: 'home' },
  library: { label: 'Subjects', icon: 'folder' },
  schedule: { label: 'Schedule', icon: 'calendar' },
  profile: { label: 'Profile', icon: 'user' },
};

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

/** Home · Subjects · [ + Create ] · Schedule · Profile. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const current = state.routes[state.index]?.key;
  // Only the four tabs above get a button. Any other file left in (tabs)/ (for example an old chat.tsx
  // from an earlier version) is ignored here instead of crashing the bar.
  const items = state.routes.filter((route) => TABS[route.name]).map((route) => {
    const meta = TABS[route.name];
    const focused = route.key === current;
    const color = focused ? C.primary : C.faint;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={st.tab}>
        <Icon name={meta.icon} size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
        <T w={800} size={12} color={color}>{meta.label}</T>
      </Pressable>
    );
  });
  const create = (
    <Pressable key="create" accessibilityRole="button" accessibilityLabel="Create a new reviewer" onPress={() => router.push('/add-reviewer')} style={st.tab}>
      <View style={st.plus}>
        <Icon name="plus" size={26} color="#422006" strokeWidth={3} />
      </View>
      <T w={800} size={12} color="#B45309">Create</T>
    </Pressable>
  );
  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {items.slice(0, 2)}
      {create}
      {items.slice(2)}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 4, minHeight: 48 },
  plus: {
    width: 54, height: 54, marginTop: -26, marginBottom: -4, borderRadius: 18, backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: C.surface, borderBottomWidth: 9, borderBottomColor: '#B45309',
    shadowColor: '#B45309', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
});
