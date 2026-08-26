import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export const metadata = {
  title: 'Complete your profile — KitabX',
};

/**
 * Post-OTP onboarding (§5): profile → city/area/society → block/flat → terms.
 * Signup collects these inline, so this route serves members who verified their
 * number before their society details existed.
 */
export default function OnboardingPage() {
  return <OnboardingWizard />;
}
