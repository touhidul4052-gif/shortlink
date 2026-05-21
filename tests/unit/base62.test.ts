import { describe, expect, it } from 'vitest';
import { BASE62_ALPHABET, decode, encode } from '../../src/utils/base62.js';

describe('base62', () => {
  it('uses 62 characters with digits, lowercase, then uppercase', () => {
    expect(BASE62_ALPHABET).toHaveLength(62);
    expect(BASE62_ALPHABET).toMatch(/^[0-9a-zA-Z]+$/);
  });

  it('encodes 0 to the alphabet zero character', () => {
    expect(encode(0)).toBe('0');
    expect(encode(0n)).toBe('0');
  });

  it('encodes small integers correctly', () => {
    expect(encode(61)).toBe('Z');
    expect(encode(62)).toBe('10');
    expect(encode(125)).toBe('21');
  });

  it('pads to minimum length without changing decoded value', () => {
    expect(encode(1, 6)).toBe('000001');
    expect(decode(encode(1, 6))).toBe(1n);
    expect(encode(0, 4)).toBe('0000');
  });

  it('round-trips a range of integer ids', () => {
    for (let n = 0; n < 5000; n += 17) {
      expect(decode(encode(n, 6))).toBe(BigInt(n));
    }
  });

  it('round-trips large bigint values', () => {
    const big = 9_223_372_036_854_775_000n;
    expect(decode(encode(big))).toBe(big);
  });

  it('rejects negative inputs', () => {
    expect(() => encode(-1)).toThrow(RangeError);
    expect(() => encode(-1n)).toThrow(RangeError);
  });

  it('rejects non-positive minLength values', () => {
    expect(() => encode(10, 0)).toThrow(RangeError);
    expect(() => encode(10, 1.5)).toThrow(RangeError);
  });

  it('rejects empty or non-string inputs to decode', () => {
    expect(() => decode('')).toThrow(TypeError);
    expect(() => decode('abc!')).toThrow(RangeError);
  });
});
