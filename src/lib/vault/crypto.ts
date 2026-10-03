import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { getRandomBytes } from 'expo-crypto';

import { fromBase64, toBase64 } from '@/lib/vault/base64';

/**
 * The household key: 32 random bytes made on her phone, shared with the
 * partner's phone in person, never sent to the server. `version` goes up when
 * the key is replaced (after a partner is removed).
 */
export type HouseholdKey = { version: number; bytes: Uint8Array };

/** What the server stores for one record: both parts base64. */
export type Sealed = { nonce: string; ciphertext: string };

/** Where a sealed record belongs. Bound into the seal, so the server cannot swap one record's blob for another's. */
export type SealContext = { pregnancyId: string; id: string };

export class VaultDecryptError extends Error {
  constructor(message = 'This record could not be unlocked with the household key.') {
    super(message);
    this.name = 'VaultDecryptError';
  }
}

const KEY_BYTES = 32;
const NONCE_BYTES = 24;

export function newHouseholdKey(version = 1): HouseholdKey {
  return { version, bytes: getRandomBytes(KEY_BYTES) };
}

// Records are JSON with every non-ASCII character escaped, so a byte is a
// character and no TextEncoder/TextDecoder is needed (Hermes has not always
// shipped TextDecoder).
function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

function asciiText(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4096) out += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return out;
}

function toJsonAscii(value: unknown): string {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function associatedData(key: HouseholdKey, context: SealContext) {
  return asciiBytes(`bloom.vault.v1:${context.pregnancyId}:${context.id}:${key.version}`);
}

/** Encrypts any JSON value with XChaCha20-Poly1305 and a fresh random nonce. */
export function seal(key: HouseholdKey, context: SealContext, value: unknown): Sealed {
  const nonce = getRandomBytes(NONCE_BYTES);
  const plaintext = asciiBytes(toJsonAscii(value));
  const ciphertext = xchacha20poly1305(key.bytes, nonce, associatedData(key, context)).encrypt(plaintext);
  return { nonce: toBase64(nonce), ciphertext: toBase64(ciphertext) };
}

/** Decrypts what `seal` made. Throws VaultDecryptError for a wrong key, a wrong record or any tampering. */
export function open(key: HouseholdKey, context: SealContext, sealed: Sealed): unknown {
  let plaintext: Uint8Array;
  try {
    const nonce = fromBase64(sealed.nonce);
    if (nonce.length !== NONCE_BYTES) throw new Error('bad nonce');
    plaintext = xchacha20poly1305(key.bytes, nonce, associatedData(key, context)).decrypt(fromBase64(sealed.ciphertext));
  } catch {
    throw new VaultDecryptError();
  }
  return JSON.parse(asciiText(plaintext));
}
