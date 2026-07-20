import { describe, it, expect } from 'vitest';
import { resolveLocale, LOCALES } from '../../src/core/i18n.js';

describe('resolveLocale', () => {
  it('auto follows a Ukrainian system locale', () => {
    expect(resolveLocale('auto', 'uk')).toBe('uk');
    expect(resolveLocale('auto', 'uk-UA')).toBe('uk');
  });
  it('auto falls to en for non-uk systems', () => {
    expect(resolveLocale('auto', 'en-US')).toBe('en');
    expect(resolveLocale('auto', 'fr')).toBe('en');
  });
  it('honors an explicit supported locale', () => {
    expect(resolveLocale('uk', 'en-US')).toBe('uk');
    expect(resolveLocale('en', 'uk')).toBe('en');
  });
  it('defaults to en for unknown settings', () => {
    expect(resolveLocale('zz', 'uk')).toBe('en');
    expect(resolveLocale(undefined, undefined)).toBe('en');
    expect(LOCALES).toEqual(['en', 'uk']);
  });
});
