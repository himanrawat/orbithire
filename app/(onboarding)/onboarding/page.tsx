import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata = { title: "Set up" };

/** /onboarding – the 4-step, stage-aware setup (PRD v2, area 1). Every step can be skipped. */
export default function OnboardingPage() {
	return <OnboardingFlow />;
}
