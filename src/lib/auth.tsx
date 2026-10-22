import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { isAuthError, type Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

export const MIN_PASSWORD_LENGTH = 8; // keep in sync with supabase/config.toml

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    // Fires once right away with the stored session, then on every sign-in, sign-out and refresh.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function displayName(session: Session | null): string {
  const name = session?.user.user_metadata?.full_name;
  return typeof name === 'string' && name.trim() ? name.trim() : (session?.user.email ?? '');
}

// Email links open Supabase's verify page, which redirects here with the new session.
const callbackUrl = () => Linking.createURL('/auth-callback');

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: name.trim() }, emailRedirectTo: callbackUrl() },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: callbackUrl() },
  });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: callbackUrl(),
  });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' });
}

/**
 * Collects the auth details Supabase appends to the redirect: the session in the URL fragment
 * on success, or `error_description` (query or fragment) when the link is expired or used.
 */
export function authLinkParams(
  routeParams: Record<string, string | string[] | undefined>,
  linkingUrl: string | null,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(routeParams)) {
    if (key !== '#' && typeof value === 'string') params.set(key, value);
  }
  let fragment = typeof routeParams['#'] === 'string' ? routeParams['#'] : '';
  if (!fragment && linkingUrl?.includes('#')) fragment = linkingUrl.slice(linkingUrl.indexOf('#') + 1);
  new URLSearchParams(fragment).forEach((value, key) => params.set(key, value));
  return params;
}

/** Signs in with the session from an email link. Returns the link type, e.g. "signup" or "recovery". */
export async function signInFromLink(params: URLSearchParams): Promise<string | null> {
  if (params.get('error_code') === 'otp_expired') {
    throw new Error('This link has expired or was already used.');
  }
  const linkError = params.get('error_description') ?? params.get('error');
  if (linkError) throw new Error(linkError);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) {
    throw new Error('This link is missing its sign-in details. Try opening it from the email again.');
  }
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return params.get('type');
}

export function isUnconfirmedEmail(e: unknown): boolean {
  return isAuthError(e) && e.code === 'email_not_confirmed';
}

export function authErrorMessage(e: unknown): string {
  if (isAuthError(e)) {
    switch (e.code) {
      case 'invalid_credentials':
        return "That email and password don't match. Try again or reset your password.";
      case 'email_not_confirmed':
        return 'Confirm your email first. Tap the link we sent you.';
      case 'same_password':
        return 'Choose a password different from your current one.';
      case 'weak_password':
        return `That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Too many tries just now. Please wait a minute and try again.';
      case 'email_address_invalid':
        return "That email address doesn't look right.";
      case 'signup_disabled':
        return 'Sign-ups are closed right now.';
    }
  }
  return e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';
}

export function nameError(name: string): string | undefined {
  if (!name.trim()) return 'Tell us your name.';
  if (name.trim().length > 80) return 'Keep your name under 80 characters.';
}

export function emailError(email: string): string | undefined {
  if (!email.trim()) return 'Enter your email.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "That email doesn't look right.";
}

export function passwordError(password: string): string | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
}

/** Returns to sign-in without stacking a second copy of it. */
export function backToSignIn() {
  if (router.canGoBack()) router.back();
  else router.replace('/sign-in');
}
