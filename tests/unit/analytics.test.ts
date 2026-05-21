import { describe, expect, it } from 'vitest';
import { classifyDevice, isLikelyBot } from '../../src/services/analytics.service.js';

const UA = {
  chromeMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15',
  googlebot:
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  facebookHit: 'facebookexternalhit/1.1',
};

describe('analytics helpers', () => {
  it('classifyDevice returns desktop for a desktop Chrome UA', () => {
    expect(classifyDevice(UA.chromeMac)).toBe('desktop');
  });

  it('classifyDevice detects mobile and tablet user agents', () => {
    expect(classifyDevice(UA.iphone)).toBe('mobile');
    expect(classifyDevice(UA.ipad)).toBe('tablet');
  });

  it('classifyDevice handles null/empty UA', () => {
    expect(classifyDevice(null)).toBeNull();
    expect(classifyDevice('')).toBeNull();
  });

  it('isLikelyBot returns false for normal browsers', () => {
    expect(isLikelyBot(UA.chromeMac)).toBe(false);
    expect(isLikelyBot(UA.iphone)).toBe(false);
  });

  it('isLikelyBot flags common crawlers and scrapers', () => {
    expect(isLikelyBot(UA.googlebot)).toBe(true);
    expect(isLikelyBot(UA.facebookHit)).toBe(true);
    expect(isLikelyBot('Some-Spider/2.0')).toBe(true);
  });

  it('isLikelyBot returns false when UA missing', () => {
    expect(isLikelyBot(null)).toBe(false);
    expect(isLikelyBot('')).toBe(false);
  });
});
