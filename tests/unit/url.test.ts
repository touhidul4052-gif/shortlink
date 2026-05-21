import { describe, expect, it } from 'vitest';
import { InvalidUrlError, canonicalizeUrl } from '../../src/utils/url.js';

describe('canonicalizeUrl', () => {
  it('accepts a basic https URL and preserves the path', () => {
    expect(canonicalizeUrl('https://example.com/foo?bar=baz')).toBe(
      'https://example.com/foo?bar=baz',
    );
  });

  it('lowercases protocol and host', () => {
    expect(canonicalizeUrl('HTTPS://EXAMPLE.com/Path')).toBe(
      'https://example.com/Path',
    );
  });

  it('removes default ports', () => {
    expect(canonicalizeUrl('http://example.com:80/')).toBe(
      'http://example.com/',
    );
    expect(canonicalizeUrl('https://example.com:443/')).toBe(
      'https://example.com/',
    );
  });

  it('normalizes empty path to /', () => {
    expect(canonicalizeUrl('https://example.com')).toBe('https://example.com/');
  });

  it('rejects empty input', () => {
    expect(() => canonicalizeUrl('   ')).toThrow(InvalidUrlError);
  });

  it('rejects non-http(s) protocols', () => {
    expect(() => canonicalizeUrl('javascript:alert(1)')).toThrow(
      InvalidUrlError,
    );
    expect(() => canonicalizeUrl('ftp://example.com')).toThrow(InvalidUrlError);
    expect(() => canonicalizeUrl('file:///etc/passwd')).toThrow(InvalidUrlError);
  });

  it('rejects malformed URLs', () => {
    expect(() => canonicalizeUrl('not a url')).toThrow(InvalidUrlError);
  });

  it('rejects URLs longer than 2048 characters', () => {
    const long = 'https://example.com/' + 'a'.repeat(2100);
    expect(() => canonicalizeUrl(long)).toThrow(InvalidUrlError);
  });
});
