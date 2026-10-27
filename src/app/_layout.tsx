import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from '@expo-google-fonts/quicksand';

import { AuthProvider, useAuth } from '@/lib/auth';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {/* On web there's no splash screen to hide behind, and waiting for fonts on a slow phone
            connection means a blank page. The browser swaps the fonts in when they arrive. */}
        <RootNavigator fontsReady={loaded || !!error || process.env.EXPO_OS === 'web'} />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, loading } = useAuth();
  const ready = fontsReady && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const signedIn = !!session;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.blush },
      }}
    >
      {/* Today's questions, awards and settings are open to everyone; accounts unlock history. */}
      <Stack.Screen name="index" />
      <Stack.Screen name="awards" />
      <Stack.Screen name="settings" />
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="history" />
        <Stack.Screen name="reset-password" />
      </Stack.Protected>
      {/* Signing in from here continues to history, which is what it's for. */}
      <Stack.Protected guard={!signedIn} redirectTo="/history">
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      {/* Email links land here signed in or out. */}
      <Stack.Screen name="auth-callback" />
    </Stack>
  );
}
