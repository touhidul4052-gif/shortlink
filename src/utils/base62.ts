const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BASE = BigInt(ALPHABET.length);

const INDEX_LOOKUP: Record<string, number> = Object.fromEntries(
  [...ALPHABET].map((ch, idx) => [ch, idx]),
);

export const BASE62_ALPHABET = ALPHABET;
export const BASE62_PATTERN = /^[0-9a-zA-Z]+$/;

/**
 * Encode a non-negative integer ID into a Base62 string.
 *
 * Pads the output to `minLength` using leading zeros (the alphabet's
 * lowest character). The padding does not change the decoded value:
 * `decode(encode(id, n)) === id` for any padded width `n`.
 */
export function encode(id: number | bigint, minLength = 1): string {
  const n = typeof id === 'bigint' ? id : BigInt(id);
  if (n < 0n) {
    throw new RangeError('Base62 encoding requires a non-negative integer');
  }
  if (!Number.isInteger(minLength) || minLength < 1) {
    throw new RangeError('minLength must be a positive integer');
  }

  if (n === 0n) {
    return ALPHABET[0]!.repeat(minLength);
  }

  let value = n;
  let out = '';
  while (value > 0n) {
    const remainder = Number(value % BASE);
    out = ALPHABET[remainder]! + out;
    value /= BASE;
  }

  if (out.length < minLength) {
    out = ALPHABET[0]!.repeat(minLength - out.length) + out;
  }
  return out;
}

/**
 * Decode a Base62 string back to a BigInt. Leading padding characters
 * (the alphabet's zero) are absorbed naturally.
 *
 * Throws if the input contains any character outside the Base62 alphabet.
 */
export function decode(token: string): bigint {
  if (typeof token !== 'string' || token.length === 0) {
    throw new TypeError('Base62 decode requires a non-empty string');
  }
  let result = 0n;
  for (const ch of token) {
    const digit = INDEX_LOOKUP[ch];
    if (digit === undefined) {
      throw new RangeError(`Invalid Base62 character: "${ch}"`);
    }
    result = result * BASE + BigInt(digit);
  }
  return result;
}
