import { fromBase64, toBase64 } from '@/lib/vault/base64';
import { newHouseholdKey, open, seal, VaultDecryptError } from '@/lib/vault/crypto';
import { latin1 } from '@/lib/vault/testHelpers';

jest.mock('expo-crypto', () => ({
  getRandomBytes: (n: number) => crypto.getRandomValues(new Uint8Array(n)),
}));

const where = { pregnancyId: 'p1', id: 'r1' };

describe('seal and open', () => {
  it('round-trips any JSON, including non-English text and emoji', () => {
    const key = newHouseholdKey();
    const value = { note: 'मतली, थोड़ा चक्कर 🤢', bp: [112, 74], ok: true, nothing: null };
    expect(open(key, where, seal(key, where, value))).toEqual(value);
  });

  it('never repeats a nonce and never shows the plaintext', () => {
    const key = newHouseholdKey();
    const a = seal(key, where, { type: 'weight', value: 64.2 });
    const b = seal(key, where, { type: 'weight', value: 64.2 });
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(latin1(fromBase64(a.ciphertext))).not.toContain('weight');
    expect(a.nonce).toHaveLength(32);
  });

  it('refuses the wrong key', () => {
    const sealed = seal(newHouseholdKey(), where, { x: 1 });
    expect(() => open(newHouseholdKey(), where, sealed)).toThrow(VaultDecryptError);
  });

  it("refuses one record's blob passed off as another's, or in another household", () => {
    const key = newHouseholdKey();
    const sealed = seal(key, where, { x: 1 });
    expect(() => open(key, { ...where, id: 'r2' }, sealed)).toThrow(VaultDecryptError);
    expect(() => open(key, { ...where, pregnancyId: 'p2' }, sealed)).toThrow(VaultDecryptError);
  });

  it('refuses a blob sealed under an older key version', () => {
    const key = newHouseholdKey(1);
    const sealed = seal(key, where, { x: 1 });
    expect(() => open({ ...key, version: 2 }, where, sealed)).toThrow(VaultDecryptError);
  });

  it('refuses a tampered blob', () => {
    const key = newHouseholdKey();
    const sealed = seal(key, where, { x: 1 });
    const bytes = fromBase64(sealed.ciphertext);
    bytes[0] ^= 1;
    expect(() => open(key, where, { ...sealed, ciphertext: toBase64(bytes) })).toThrow(VaultDecryptError);
    expect(() => open(key, where, { ...sealed, nonce: 'not base64!' })).toThrow(VaultDecryptError);
  });
});
