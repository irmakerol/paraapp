import { describe, expect, it } from 'vitest';
import { localeOf, withLocale } from './preferred-locale';

describe('withLocale', () => {
  it('swaps the language prefix', () => {
    expect(withLocale('/tr/onboarding', 'en')).toBe('/en/onboarding');
    expect(withLocale('/tr', 'en')).toBe('/en');
    expect(withLocale('/en/account?saved=1', 'tr')).toBe('/tr/account?saved=1');
  });
  it('leaves other paths and unknown languages alone', () => {
    expect(withLocale('/api/x', 'en')).toBe('/api/x');
    expect(withLocale('/de/x', 'en')).toBe('/de/x');
    expect(withLocale('/tr/x', 'de')).toBe('/tr/x');
  });
});

describe('localeOf', () => {
  it('reads the prefix or falls back to Turkish', () => {
    expect(localeOf('/en/onboarding')).toBe('en');
    expect(localeOf('/en?x=1')).toBe('en');
    expect(localeOf('/onboarding')).toBe('tr');
  });
});
