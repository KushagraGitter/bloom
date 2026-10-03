import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Closes the auth popup when the app is reopened from it (web only; no-op on native).
WebBrowser.maybeCompleteAuthSession();

/**
 * Where Google sends the user back after sign-in. In a build this is
 * `bloom://auth/callback`; in Expo Go it is an `exp://…/--/auth/callback`
 * URL. Both must be listed under Supabase → Authentication → URL Configuration.
 */
export function authRedirectUri(): string {
  return makeRedirectUri({ scheme: 'bloom', path: 'auth/callback' });
}

export type CallbackParams = { code?: string; error?: string };

/** Reads `code` or `error_description` from a redirect URL's query or fragment. */
export function parseAuthCallback(url: string): CallbackParams {
  const params: Record<string, string> = {};
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const parts: string[] = [];
  if (queryStart !== -1) parts.push(url.slice(queryStart + 1, hashStart > queryStart ? hashStart : undefined));
  if (hashStart !== -1) parts.push(url.slice(hashStart + 1));
  for (const part of parts) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  const error = params.error_description ?? params.error;
  return { code: params.code, error };
}

/**
 * Google sign-in through Supabase's hosted OAuth page in an in-app browser
 * sheet. Works in Expo Go; the Google client ID and secret live in Supabase.
 *
 * On web the page itself goes to Google and back to `/auth/callback`, where
 * the Supabase client exchanges the code (`detectSessionInUrl`). A popup
 * opened after the network request would lose the tap and be blocked.
 */
export async function signInWithGoogle(): Promise<'signed-in' | 'cancelled' | 'redirecting'> {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
    return 'redirecting';
  }

  const redirectTo = authRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';

  const { code, error: callbackError } = parseAuthCallback(result.url);
  if (callbackError) throw new Error(callbackError);
  if (!code) throw new Error('Sign-in did not return a code.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
    data.flowId ? { flowId: data.flowId } : undefined,
  );
  if (exchangeError) throw exchangeError;
  return 'signed-in';
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
