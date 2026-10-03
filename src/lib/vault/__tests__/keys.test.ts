import * as SecureStore from 'expo-secure-store';

import { newHouseholdKey } from '@/lib/vault/crypto';
import {
  forgetHouseholdKey,
  fromRecoveryPhrase,
  loadHouseholdKey,
  RecoveryPhraseError,
  saveHouseholdKey,
  toRecoveryPhrase,
} from '@/lib/vault/keys';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));
jest.mock('expo-secure-store', () => {
  const mockItems = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 'after-first-unlock',
    setItemAsync: jest.fn(async (k: string, v: string) => void mockItems.set(k, v)),
    getItemAsync: jest.fn(async (k: string) => mockItems.get(k) ?? null),
    deleteItemAsync: jest.fn(async (k: string) => void mockItems.delete(k)),
  };
});

const bytes = (key: { bytes: Uint8Array }) => Array.from(key.bytes);

describe('household key on the phone', () => {
  it('is saved per pregnancy in the keychain, readable after first unlock', async () => {
    const key = newHouseholdKey(3);
    await saveHouseholdKey('p1', key);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('bloom.vault.p1', expect.any(String), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });

    const loaded = await loadHouseholdKey('p1');
    expect(loaded?.version).toBe(3);
    expect(bytes(loaded!)).toEqual(bytes(key));
    expect(await loadHouseholdKey('p2')).toBeNull();

    await forgetHouseholdKey('p1');
    expect(await loadHouseholdKey('p1')).toBeNull();
  });
});

describe('recovery phrase', () => {
  it('writes the key out in readable groups and reads it back', () => {
    const key = newHouseholdKey(2);
    const phrase = toRecoveryPhrase(key);
    expect(phrase).toMatch(/^K2(-[0-9A-HJKMNP-TV-Z]{1,4}){14}$/);
    const back = fromRecoveryPhrase(phrase);
    expect(back.version).toBe(2);
    expect(bytes(back)).toEqual(bytes(key));
  });

  it('forgives case, spaces and the letters people mix up with digits', () => {
    const key = newHouseholdKey();
    const phrase = toRecoveryPhrase(key);
    const sloppy = phrase.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(bytes(fromRecoveryPhrase(sloppy))).toEqual(bytes(key));
  });

  it('catches a typo instead of producing a wrong key', () => {
    const phrase = toRecoveryPhrase({ version: 1, bytes: Uint8Array.from({ length: 32 }, (_, i) => i * 7) });
    // Any other symbol in any position, the half-used last one included.
    for (const position of [3, 20, 40, phrase.length - 1]) {
      for (const other of '0123456789ABCDEFGHJKMNPQRSTVWXYZ') {
        if (other === phrase[position] || phrase[position] === '-') continue;
        const typo = phrase.slice(0, position) + other + phrase.slice(position + 1);
        expect(() => fromRecoveryPhrase(typo)).toThrow(RecoveryPhraseError);
      }
    }
    expect(() => fromRecoveryPhrase(phrase.slice(0, -5))).toThrow(RecoveryPhraseError);
    expect(() => fromRecoveryPhrase('hello')).toThrow(RecoveryPhraseError);
    expect(() => fromRecoveryPhrase(phrase.replace(/^K1-/, ''))).toThrow(RecoveryPhraseError);
  });
});

describe('recovery phrase version', () => {
  it('is not confused by key symbols that start with a digit', () => {
    // Find a key whose phrase starts with a digit right after the version.
    let key = newHouseholdKey();
    while (!/^K1-\d/.test(toRecoveryPhrase(key))) key = newHouseholdKey();
    const back = fromRecoveryPhrase(toRecoveryPhrase(key));
    expect(back.version).toBe(1);
    expect(bytes(back)).toEqual(bytes(key));
  });
});
