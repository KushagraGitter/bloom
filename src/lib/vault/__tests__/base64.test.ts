import { fromBase64, toBase64 } from '@/lib/vault/base64';

describe('base64', () => {
  it('matches Node for every length and byte value', () => {
    for (let n = 0; n < 70; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) % 256);
      const expected = btoa(String.fromCharCode(...bytes));
      expect(toBase64(bytes)).toBe(expected);
      expect(Array.from(fromBase64(expected))).toEqual(Array.from(bytes));
    }
  });

  it('rejects text that is not base64', () => {
    expect(() => fromBase64('abc')).toThrow();
    expect(() => fromBase64('ab!d')).toThrow();
    expect(() => fromBase64('a=bc')).toThrow();
  });
});
