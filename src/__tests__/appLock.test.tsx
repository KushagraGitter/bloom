import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, type AppStateStatus } from 'react-native';

import { AppLock } from '@/components/AppLock';
import { LOCK_AFTER_MS, lockAvailability, useAppLock } from '@/lib/appLock';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (k: string) => mockStore.get(k) ?? null),
  setItemAsync: jest.fn(async (k: string, v: string) => void mockStore.set(k, v)),
  deleteItemAsync: jest.fn(async (k: string) => void mockStore.delete(k)),
}));
jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  hasHardwareAsync: jest.fn(async () => true),
  isEnrolledAsync: jest.fn(async () => true),
  getEnrolledLevelAsync: jest.fn(async () => 3),
  authenticateAsync: jest.fn(async () => ({ success: true })),
}));

const auth = jest.mocked(LocalAuthentication.authenticateAsync);
let appState: (s: AppStateStatus) => void;

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  useAppLock.setState({ enabled: null, locked: false });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
    appState = listener as (s: AppStateStatus) => void;
    return { remove: () => {} } as never;
  });
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
  });

describe('AppLock', () => {
  it('shows nothing once it knows the lock is off', async () => {
    await render(<AppLock />);
    await settle();
    expect(screen.queryByTestId('app-lock-loading')).toBeNull();
    expect(screen.queryByText('Bloom is locked')).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });

  it('starts locked when the lock is on, and opens once she gets through', async () => {
    mockStore.set('bloom.appLock', 'on');
    auth.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await render(<AppLock />);
    expect(await screen.findByText('That didn’t work. Try again when you’re ready.')).toBeTruthy();
    expect(auth).toHaveBeenCalledWith({ promptMessage: 'Unlock Bloom', cancelLabel: 'Cancel' });

    await fireEvent.press(screen.getByRole('button', { name: 'Unlock' }));
    await settle();
    expect(screen.queryByText('Bloom is locked')).toBeNull();
  });

  it('locks again only after a minute in the background', async () => {
    mockStore.set('bloom.appLock', 'on');
    const now = jest.spyOn(Date, 'now');
    await render(<AppLock />);
    await settle();
    expect(screen.queryByText('Bloom is locked')).toBeNull();

    now.mockReturnValue(1_000_000);
    await act(async () => appState('background'));
    now.mockReturnValue(1_000_000 + LOCK_AFTER_MS - 1);
    await act(async () => appState('active'));
    expect(screen.queryByText('Bloom is locked')).toBeNull();

    auth.mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    await act(async () => appState('background'));
    now.mockReturnValue(1_000_000 + 2 * LOCK_AFTER_MS + 1);
    await act(async () => appState('active'));
    expect(await screen.findByText('Bloom is locked')).toBeTruthy();
    now.mockRestore();
  });
});

describe('lockAvailability', () => {
  it('needs Face ID, a fingerprint or at least a passcode', async () => {
    expect(await lockAvailability()).toBe('ok');
    jest.mocked(LocalAuthentication.isEnrolledAsync).mockResolvedValueOnce(false);
    jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValueOnce(LocalAuthentication.SecurityLevel.NONE);
    expect(await lockAvailability()).toBe('not_enrolled');
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockResolvedValueOnce(false);
    jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValueOnce(LocalAuthentication.SecurityLevel.SECRET);
    expect(await lockAvailability()).toBe('ok');
    jest.mocked(LocalAuthentication.hasHardwareAsync).mockRejectedValueOnce(new Error('web'));
    expect(await lockAvailability()).toBe('no_hardware');
  });
});
