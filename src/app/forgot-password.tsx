import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { authErrorMessage, backToSignIn, emailError, sendPasswordReset } from '@/lib/auth';
import { colors, fonts } from '@/theme';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    const invalid = emailError(email);
    setError(invalid);
    if (invalid) return;

    setBusy(true);
    setMessage(null);
    try {
      await sendPasswordReset(email);
      setSentTo(email.trim());
    } catch (e) {
      setMessage(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={
          <>
            {"If there's an account for "}
            <Text style={styles.strong}>{sentTo}</Text>
            {', we sent it a link to reset your password. Open it on this phone. It expires in 1 hour.'}
          </>
        }
      >
        {message && <Notice tone="error">{message}</Notice>}
        <Button label="Back to sign in" onPress={backToSignIn} />
        <Button label="Send it again" variant="text" loading={busy} onPress={submit} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your account's email and we'll send you a link to choose a new one."
    >
      {message && <Notice tone="error">{message}</Notice>}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={error}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="send"
        onSubmitEditing={submit}
      />
      <Button label="Send reset link" loading={busy} onPress={submit} />
      <Button label="Back to sign in" variant="text" onPress={backToSignIn} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fonts.bodyBold, color: colors.espresso },
});
