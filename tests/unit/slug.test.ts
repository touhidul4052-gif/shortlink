import { describe, expect, it } from 'vitest';
import { InvalidSlugError, validateCustomSlug } from '../../src/utils/slug.js';

describe('validateCustomSlug', () => {
  it('accepts simple alphanumeric slugs', () => {
    expect(validateCustomSlug('promo')).toBe('promo');
    expect(validateCustomSlug('my-promo')).toBe('my-promo');
    expect(validateCustomSlug('blog_2024')).toBe('blog_2024');
  });

  it('rejects slugs that are too short or too long', () => {
    expect(() => validateCustomSlug('ab')).toThrow(InvalidSlugError);
    expect(() => validateCustomSlug('a'.repeat(31))).toThrow(InvalidSlugError);
  });

  it('rejects slugs containing illegal characters', () => {
    expect(() => validateCustomSlug('hello!')).toThrow(InvalidSlugError);
    expect(() => validateCustomSlug('path/segment')).toThrow(InvalidSlugError);
    expect(() => validateCustomSlug("'or 1=1--")).toThrow(InvalidSlugError);
  });

  it('rejects slugs that start with a separator', () => {
    expect(() => validateCustomSlug('-leading')).toThrow(InvalidSlugError);
    expect(() => validateCustomSlug('_leading')).toThrow(InvalidSlugError);
  });

  it('rejects reserved words case-insensitively', () => {
    expect(() => validateCustomSlug('api')).toThrow(InvalidSlugError);
    expect(() => validateCustomSlug('API')).toThrow(InvalidSlugError);
    expect(() => validateCustomSlug('health')).toThrow(InvalidSlugError);
  });
});
