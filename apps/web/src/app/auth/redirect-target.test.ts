import { describe, expect, it } from 'vitest';
import { redirectTarget } from './redirect-target';

const origin = 'http://localhost:3000';

describe('redirectTarget', () => {
  it('accepts same-origin absolute URLs and relative paths', () => {
    expect(redirectTarget('http://localhost:3000/en/onboarding', origin)).toBe('/en/onboarding');
    expect(redirectTarget('/tr/account', origin)).toBe('/tr/account');
  });
  it('rejects other origins', () => {
    expect(redirectTarget('https://evil.example/tr', origin)).toBe('/tr/onboarding');
    expect(redirectTarget('//evil.example', origin)).toBe('/tr/onboarding');
  });
  it('falls back when missing', () => {
    expect(redirectTarget(null, origin)).toBe('/tr/onboarding');
  });
});
