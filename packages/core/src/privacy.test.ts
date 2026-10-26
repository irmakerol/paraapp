import { describe, expect, it } from 'vitest';
import { canView, defaultFieldPrivacy, defaultFlightVisibility } from './privacy';

describe('privacy', () => {
  it('keeps minors private by default', () => {
    expect(Object.values(defaultFieldPrivacy('minor')).every((v) => v === 'private')).toBe(true);
    expect(defaultFlightVisibility('minor')).toBe('private');
  });
  it('defaults adult flights to public', () => {
    expect(defaultFlightVisibility('adult')).toBe('public');
  });
  it('applies visibility rules', () => {
    const stranger = { isOwner: false, isMember: false };
    const member = { isOwner: false, isMember: true };
    const owner = { isOwner: true, isMember: false };
    expect(canView('public', stranger)).toBe(true);
    expect(canView('members', stranger)).toBe(false);
    expect(canView('members', member)).toBe(true);
    expect(canView('private', member)).toBe(false);
    expect(canView('private', owner)).toBe(true);
  });
});
