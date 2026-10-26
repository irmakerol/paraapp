import { describe, expect, it } from 'vitest';
import { nextOnboardingStep } from './onboarding';

const done = { status: 'active', pendingLegal: [], hasConsentRecords: true } as const;

describe('nextOnboardingStep', () => {
  it('asks for age first', () => {
    expect(nextOnboardingStep({ ...done, status: 'onboarding', pendingLegal: ['terms'] })).toBe(
      'age',
    );
  });
  it('then legal texts, then consents', () => {
    expect(nextOnboardingStep({ ...done, pendingLegal: ['terms'], hasConsentRecords: false })).toBe(
      'legal',
    );
    expect(nextOnboardingStep({ ...done, hasConsentRecords: false })).toBe('consents');
  });
  it('re-prompts for legal texts after a material change', () => {
    expect(nextOnboardingStep({ ...done, pendingLegal: ['privacy_notice'] })).toBe('legal');
  });
  it('holds minors at the guardian step', () => {
    expect(nextOnboardingStep({ ...done, status: 'pending_guardian' })).toBe('guardian');
  });
  it('lets active users through', () => {
    expect(nextOnboardingStep(done)).toBeNull();
  });
});
