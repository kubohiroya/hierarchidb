import { describe, expect, it } from 'vitest';

import { isoCodeToFlagEmoji, normalizeIsoCode, resolveFlagSymbol } from '../flagEmoji';

describe('flagEmoji', () => {
  it('normalizes iso code', () => {
    expect(normalizeIsoCode(' jp ')).toBe('JP');
  });

  it('returns null for invalid iso code', () => {
    expect(normalizeIsoCode('JPN')).toBeNull();
    expect(normalizeIsoCode('1a')).toBeNull();
  });

  it('creates emoji from ISO alpha-2', () => {
    expect(isoCodeToFlagEmoji('jp')).toBe('🇯🇵');
    expect(isoCodeToFlagEmoji('US')).toBe('🇺🇸');
  });

  it('returns fallback symbol for invalid code', () => {
    expect(resolveFlagSymbol('XXX')).toBe('⬜');
    expect(resolveFlagSymbol('XXX', { fallbackSymbol: '?' })).toBe('?');
  });
});
