import { describe, expect, it } from 'vitest';
import { defaultFieldPrivacy } from './privacy';
import { profileSchema, signUpSchema } from './schemas';

describe('signUpSchema', () => {
  it('normalises email and enforces password length', () => {
    const ok = signUpSchema.safeParse({ email: ' Pilot@Example.com ', password: 'longenough1' });
    expect(ok.success && ok.data.email).toBe('pilot@example.com');
    expect(signUpSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false);
  });
});

describe('profileSchema', () => {
  it('turns empty optional strings into null', () => {
    const parsed = profileSchema.parse({
      display_name: 'Ayşe',
      bio: '',
      years_flying: '3',
      field_privacy: defaultFieldPrivacy('adult'),
    });
    expect(parsed.bio).toBeNull();
    expect(parsed.years_flying).toBe(3);
  });
  it('rejects unknown visibility values', () => {
    const result = profileSchema.safeParse({
      display_name: 'Ayşe',
      field_privacy: { ...defaultFieldPrivacy('adult'), bio: 'everyone' },
    });
    expect(result.success).toBe(false);
  });
});
