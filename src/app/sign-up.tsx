import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInputInstance } from 'react-native';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { ResendVerification } from '@/components/ResendVerification';
import { TextField } from '@/components/TextField';
import {
  authErrorMessage,
  backToSignIn,
  emailError,
  MIN_PASSWORD_LENGTH,
  nameError,
  passwordError,
  signUp,
} from '@/lib/auth';
import { colors, fonts } from '@/theme';

type Errors = { name?: string; email?: string; password?: string };

export default function SignUpScreen() {
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    const next: Errors = { name: nameError(name), email: emailError(email), password: passwordError(password) };
    setErrors(next);
    if (next.name || next.email || next.password) return;

    setBusy(true);
    setMessage(null);
    try {
      const { session } = await signUp(name, email, password);
      // With confirmations on there is no session until the email link is tapped.
      if (!session) setSentTo(email.trim());
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
            We sent a verification link to <Text style={styles.strong}>{sentTo}</Text>.
            {" Tap it on this phone to confirm your email and you'll be signed in."}
          </>
        }
      >
        <Notice tone="info">
          No email after a few minutes? Check your spam folder. If you already have an account,
          sign in instead.
        </Notice>
        <ResendVerification email={sentTo} />
        <Button label="Back to sign in" onPress={backToSignIn} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="One question a day keeps exam nerves away."
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Button label="Sign in" variant="secondary" onPress={backToSignIn} />
        </View>
      }
    >
      {message && <Notice tone="error">{message}</Notice>}

      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
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
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button label="Create account" loading={busy} onPress={submit} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  strong: { fontFamily: fonts.bodyBold, color: colors.espresso },
  footer: { alignItems: 'center', gap: 10 },
  footerText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.mocha },
});
