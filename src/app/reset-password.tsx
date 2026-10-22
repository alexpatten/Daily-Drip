import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { router } from 'expo-router';

import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { TextField } from '@/components/TextField';
import { authErrorMessage, MIN_PASSWORD_LENGTH, passwordError, updatePassword } from '@/lib/auth';

type Errors = { password?: string; confirm?: string };

// Reached from the password reset email, which signs the user in first.
export default function ResetPasswordScreen() {
  const confirmRef = useRef<TextInputInstance>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    const next: Errors = {
      password: passwordError(password),
      confirm: confirm === password ? undefined : "Passwords don't match.",
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setBusy(true);
    setMessage(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setMessage(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="Password updated" subtitle="You're all set. Use your new password next time you sign in.">
        <Button label="Go to today's question" onPress={() => router.replace('/')} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you haven't used here before.">
      {message && <Notice tone="error">{message}</Notice>}
      <TextField
        label="New password"
        password
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label="Confirm new password"
        password
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Button label="Update password" loading={busy} onPress={submit} />
    </AuthLayout>
  );
}
