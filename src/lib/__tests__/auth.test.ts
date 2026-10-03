import { parseAuthCallback } from '../auth';

// jest hoists these above the import.
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn(), openAuthSessionAsync: jest.fn() }));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'bloom://auth/callback') }));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

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
