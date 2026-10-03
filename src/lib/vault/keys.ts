import { sha256 } from '@noble/hashes/sha2.js';
import * as SecureStore from 'expo-secure-store';

import { fromBase64, toBase64 } from '@/lib/vault/base64';
import type { HouseholdKey } from '@/lib/vault/crypto';

// ---------------------------------------------------------------------------
// Keeping the key on the phone
// ---------------------------------------------------------------------------

// Readable after the phone's first unlock, so a sync can run in the
// background. Not "this device only": an encrypted iCloud or Google backup
// restored onto a new phone brings the key with it, which is a second way back
// after a lost phone besides the recovery phrase.
const STORE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const storeKey = (pregnancyId: string) => `bloom.vault.${pregnancyId}`;

export async function saveHouseholdKey(pregnancyId: string, key: HouseholdKey): Promise<void> {
  await SecureStore.setItemAsync(storeKey(pregnancyId), JSON.stringify({ v: key.version, k: toBase64(key.bytes) }), STORE_OPTIONS);
}

/** The household key on this phone, or null if this phone has not been given it yet. */
export async function loadHouseholdKey(pregnancyId: string): Promise<HouseholdKey | null> {
  const stored = await SecureStore.getItemAsync(storeKey(pregnancyId), STORE_OPTIONS);
  if (!stored) return null;
  const { v, k } = JSON.parse(stored) as { v: number; k: string };
  return { version: v, bytes: fromBase64(k) };
}

export async function forgetHouseholdKey(pregnancyId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storeKey(pregnancyId), STORE_OPTIONS);
}

// ---------------------------------------------------------------------------
// Recovery phrase: the key written out for her to keep somewhere safe
// ---------------------------------------------------------------------------

// Crockford base32: no I, L, O or U, so it reads back without confusion.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHECK_BYTES = 2;

export class RecoveryPhraseError extends Error {
  constructor(message = "That recovery phrase isn't right. Check it for typos.") {
    super(message);
    this.name = 'RecoveryPhraseError';
  }
}

/**
 * The key version and the key, plus a two-byte checksum so a typo is caught
 * instead of producing a wrong key, in 55 characters grouped in fours
 * (`K1-ABCD-EFGH-…`).
 */
export function toRecoveryPhrase(key: HouseholdKey): string {
  const body = new Uint8Array([...key.bytes, ...sha256(key.bytes).subarray(0, CHECK_BYTES)]);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of body) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return [`K${key.version}`, ...(out.match(/.{1,4}/g) ?? [])].join('-');
}

export function fromRecoveryPhrase(phrase: string): HouseholdKey {
  // Forgive the letters people mix up with digits.
  const fix = (text: string) => text.replace(/[IL]/g, '1').replace(/O/g, '0');
  // The version needs a separator after it: in "K1-0ABC" the 0 is key, not version.
  const match = /^K([0-9ILO]+)[\s-]+(.+)$/s.exec(phrase.trim().toUpperCase());
  if (!match) throw new RecoveryPhraseError();
  const version = Number(fix(match[1]));
  if (!Number.isSafeInteger(version) || version < 1) throw new RecoveryPhraseError();
  const symbols = fix(match[2].replace(/[\s-]/g, ''));

  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of symbols) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new RecoveryPhraseError();
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >> (bits - 8)) & 255);
      bits -= 8;
      value &= (1 << bits) - 1;
    }
  }
  // The last symbol only half-carries data; its spare bits must be zero, or a
  // typo there would slip past the checksum.
  if (bytes.length !== 32 + CHECK_BYTES || value !== 0) throw new RecoveryPhraseError();
  const key = new Uint8Array(bytes.slice(0, 32));
  const check = sha256(key).subarray(0, CHECK_BYTES);
  if (check.some((b, i) => b !== bytes[32 + i])) throw new RecoveryPhraseError();
  return { version, bytes: key };
}
