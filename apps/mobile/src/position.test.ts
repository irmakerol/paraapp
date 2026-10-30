import { describe, expect, it } from 'vitest';
import { osmLink, toDms } from './position';

describe('position formats', () => {
  it('matches the website', () => {
    expect(toDms(36.55231, 29.1619)).toBe(`36°33'08.3"N 29°09'42.8"E`);
    expect(toDms(-1.5, -2.25)).toBe(`1°30'00.0"S 2°15'00.0"W`);
    expect(osmLink(36.55231, 29.1619)).toContain('mlat=36.55231&mlon=29.16190');
  });
});
