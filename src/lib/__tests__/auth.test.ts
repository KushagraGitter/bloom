import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

import { parseAuthCallback, signInWithGoogle } from '../auth';

// jest hoists these above the import.
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'bloom://auth/callback') }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: jest.fn(), exchangeCodeForSession: jest.fn() } },
}));

describe('parseAuthCallback', () => {
  it('reads the code from the query string', () => {
    expect(parseAuthCallback('bloom://auth/callback?code=abc-123')).toEqual({ code: 'abc-123', error: undefined });
  });

  it('reads errors from the query or fragment', () => {
    expect(parseAuthCallback('bloom://auth/callback?error=access_denied&error_description=User+cancelled')).toEqual({
      code: undefined,
      error: 'User cancelled',
    });
    expect(parseAuthCallback('exp://192.168.1.2:8081/--/auth/callback#error=server_error')).toEqual({
      code: undefined,
      error: 'server_error',
    });
  });

  it('handles a query followed by a fragment', () => {
    expect(parseAuthCallback('bloom://auth/callback?code=xyz#_=_')).toMatchObject({ code: 'xyz' });
  });

  it('returns nothing for a bare URL', () => {
    expect(parseAuthCallback('bloom://auth/callback')).toEqual({ code: undefined, error: undefined });
  });
});

describe('signInWithGoogle on web', () => {
  const os = Platform.OS;
  const win = globalThis.window;
  afterEach(() => {
    Platform.OS = os;
    globalThis.window = win;
  });

  it('lets Supabase redirect the page instead of opening a popup', async () => {
    Platform.OS = 'web';
    globalThis.window = { location: { origin: 'https://bloom.example' } } as unknown as typeof globalThis.window;
    const signIn = supabase.auth.signInWithOAuth as jest.Mock;
    signIn.mockResolvedValue({ data: { url: 'https://auth' }, error: null });

    await expect(signInWithGoogle()).resolves.toBe('redirecting');
    expect(signIn).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://bloom.example/auth/callback' },
    });
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});
