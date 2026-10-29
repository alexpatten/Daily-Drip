import { Tabs } from 'expo-router';

import { NavBar, useWideNav } from '@/components/NavBar';
import { useAuth } from '@/lib/auth';
import { colors } from '@/theme';

export default function TabsLayout() {
  const signedIn = !!useAuth().session;
  const wide = useWideNav();

  return (
    <Tabs
      tabBar={(props) => <NavBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'top' : 'bottom',
        sceneStyle: { backgroundColor: colors.blush },
      }}
    >
      {/* Today's question, awards and settings are open to everyone; accounts unlock history
          and study sessions (which also need a subscription). Signed out, the menu sends
          those two to sign-in. */}
      <Tabs.Screen name="index" />
      <Tabs.Protected guard={signedIn}>
        <Tabs.Screen name="history" />
        <Tabs.Screen name="study" />
      </Tabs.Protected>
      <Tabs.Screen name="awards" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
