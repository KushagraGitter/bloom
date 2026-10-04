/**
 * The optional app lock: Face ID, a fingerprint or the phone's passcode before
 * Bloom shows anything. It is a setting on each phone, kept in the phone's
 * secure storage, so each of you decides for your own phone.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const KEY = 'bloom.appLock';

/** How long Bloom can sit in the background before it asks again. */
export const LOCK_AFTER_MS = 60_000;

/** Whether this phone can lock Bloom: it needs Face ID, a fingerprint or a passcode set up. */
export async function lockAvailability(): Promise<'ok' | 'no_hardware' | 'not_enrolled'> {
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) {
      // A phone with no biometrics can still use its passcode.
      const level = await LocalAuthentication.getEnrolledLevelAsync();
      return level === LocalAuthentication.SecurityLevel.NONE ? 'no_hardware' : 'ok';
    }
    if (await LocalAuthentication.isEnrolledAsync()) return 'ok';
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level === LocalAuthentication.SecurityLevel.NONE ? 'not_enrolled' : 'ok';
  } catch {
    return 'no_hardware';
  }
}

/** Shows the phone's own prompt. True when she got through. */
export async function authenticate(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    return result.success;
  } catch {
    return false;
  }
}

type LockState = {
  /** Null until the setting has been read from the phone. */
  enabled: boolean | null;
  locked: boolean;
  /** Reads the setting; a phone with the lock on starts locked. */
  load: () => Promise<void>;
  setEnabled: (on: boolean) => Promise<void>;
  lock: () => void;
  unlock: () => void;
};

export const useAppLock = create<LockState>((set) => ({
  enabled: null,
  locked: false,
  load: async () => {
    let on = false;
    try {
      on = (await SecureStore.getItemAsync(KEY)) === 'on';
    } catch {
      // No secure storage (the web build): the lock is off.
    }
    set({ enabled: on, locked: on });
  },
  setEnabled: async (on) => {
    if (on) await SecureStore.setItemAsync(KEY, 'on');
    else await SecureStore.deleteItemAsync(KEY);
    set({ enabled: on, locked: false });
  },
  lock: () => set((s) => (s.enabled ? { locked: true } : s)),
  unlock: () => set({ locked: false }),
}));
