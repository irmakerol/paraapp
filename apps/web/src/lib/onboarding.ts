import type { Enums } from '@/lib/supabase/database.types';

export type OnboardingStep = 'age' | 'legal' | 'consents' | 'guardian';

export interface OnboardingState {
  status: Enums<'account_status'>;
  pendingLegal: readonly string[];
  hasConsentRecords: boolean;
}

/** The next onboarding screen a signed-in user must complete, or null when done. */
export function nextOnboardingStep(state: OnboardingState): OnboardingStep | null {
  if (state.status === 'onboarding') return 'age';
  if (state.pendingLegal.length > 0) return 'legal';
  if (!state.hasConsentRecords) return 'consents';
  if (state.status === 'pending_guardian') return 'guardian';
  return null;
}
