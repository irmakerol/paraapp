import { describe, expect, it } from 'vitest';
import { publicUrl } from './storage';

describe('publicUrl', () => {
  it('builds an encoded public URL', () => {
    expect(publicUrl('ad-photos', 'u1/a b.webp')).toMatch(
      /\/storage\/v1\/object\/public\/ad-photos\/u1\/a%20b\.webp$/,
    );
  });
  it('returns null without a path', () => {
    expect(publicUrl('content', null)).toBeNull();
  });
});
