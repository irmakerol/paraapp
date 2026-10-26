import { redirect } from '@/i18n/navigation';
import { getOnboardingStep, requireViewer } from '@/lib/session';

/** Sends a signed-in user to the next onboarding step, or home when done. */
export default async function OnboardingIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const viewer = await requireViewer(locale);
  const step = await getOnboardingStep(viewer);
  return redirect({ href: step ? `/onboarding/${step}` : '/', locale });
}
