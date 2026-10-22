import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInputInstance } from 'react-native';
import { router } from 'expo-router';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { ResendVerification } from '@/components/ResendVerification';
import { TextField } from '@/components/TextField';
import { authErrorMessage, emailError, isUnconfirmedEmail, signIn } from '@/lib/auth';
import { colors, fonts } from '@/theme';

export default function SignInScreen() {
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next = { email: emailError(email), password: password ? undefined : 'Enter your password.' };
    setErrors(next);
    if (next.email || next.password) return;

    setBusy(true);
    setMessage(null);
    setUnconfirmed(false);
    try {
      await signIn(email, password);
      // The root layout moves on to history once the session lands.
    } catch (e) {
      if (isUnconfirmedEmail(e)) setUnconfirmed(true);
      else setMessage(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to see your past brews and how you did on each."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Daily Drip?</Text>
          <Button label="Create an account" variant="secondary" onPress={() => router.push('/sign-up')} />
          <Button
            label="Back to today's question"
            variant="text"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
        </View>
      }
    >
      {message && <Notice tone="error">{message}</Notice>}
      {unconfirmed && (
        <>
          <Notice tone="info">
            Confirm your email first. Tap the link we sent to {email.trim()} when you signed up.
          </Notice>
          <ResendVerification email={email} />
        </>
      )}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button
        label="Forgot password?"
        variant="text"
        onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
      />

      <Button label="Sign in" loading={busy} onPress={submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', gap: 10 },
  footerText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.mocha },
});
