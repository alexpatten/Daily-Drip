import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { authErrorMessage, resendVerification } from '@/lib/auth';

// "Resend verification email" with its own sent / error feedback.
export function ResendVerification({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function resend() {
    setSending(true);
    setResult(null);
    try {
      await resendVerification(email);
      setResult({ ok: true, message: `Sent! Check ${email.trim()} for a fresh link.` });
    } catch (e) {
      setResult({ ok: false, message: authErrorMessage(e) });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {result && <Notice tone={result.ok ? 'success' : 'error'}>{result.message}</Notice>}
      <Button label="Resend verification email" variant="secondary" loading={sending} onPress={resend} />
    </View>
  );
}
