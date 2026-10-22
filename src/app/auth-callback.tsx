import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/Button';
import { authErrorMessage, authLinkParams, backToSignIn, displayName, signInFromLink, useAuth } from '@/lib/auth';
import { colors } from '@/theme';

type Result =
  | { status: 'working' }
  | { status: 'done'; type: string | null }
  | { status: 'error'; message: string };

// Where the verification and password reset emails land after Supabase checks the link.
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams();
  const linkingUrl = Linking.useLinkingURL();
  const { session } = useAuth();
  const [result, setResult] = useState<Result>({ status: 'working' });
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    signInFromLink(authLinkParams(params, linkingUrl)).then(
      (type) => setResult({ status: 'done', type }),
      (e) => setResult({ status: 'error', message: authErrorMessage(e) }),
    );
  }, [params, linkingUrl]);

  // Password reset links continue to the new-password form once the session is in place.
  const recovering = result.status === 'done' && result.type === 'recovery';
  useEffect(() => {
    if (recovering && session) router.replace('/reset-password');
  }, [recovering, session]);

  if (result.status === 'error') {
    return (
      <AuthLayout
        title="That link didn't work"
        subtitle={`${result.message} You can get a fresh link from the sign-in screen, or just sign in if you already confirmed your email.`}
      >
        {session ? (
          <Button label="Go to today's question" onPress={() => router.replace('/')} />
        ) : (
          <Button label="Back to sign in" onPress={backToSignIn} />
        )}
      </AuthLayout>
    );
  }

  if (result.status === 'done' && !recovering && session) {
    const name = displayName(session).split(' ')[0];
    return (
      <AuthLayout
        title={`You're verified${name ? `, ${name}` : ''}!`}
        subtitle="Your email is confirmed and your first cup is ready."
      >
        <Button label="Start brewing" onPress={() => router.replace('/')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Opening your link…">
      <View style={styles.spinner}>
        <ActivityIndicator color={colors.mocha} />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  spinner: { paddingVertical: 12 },
});
