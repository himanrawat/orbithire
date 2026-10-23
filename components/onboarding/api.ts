/** Client calls for /api/onboarding, shared by the setup flow and Settings. */

import type { OnboardingInput, OnboardingProfile } from "@/lib/onboarding/schema";

export async function fetchOnboarding(): Promise<OnboardingProfile | null> {
	try {
		const response = await fetch("/api/onboarding", { cache: "no-store" });
		if (!response.ok) return null;
		const data = (await response.json()) as { onboarding?: OnboardingProfile };
		return data.onboarding ?? null;
	} catch {
		return null;
	}
}

/** Returns an error message, or null when the save worked. */
export async function saveOnboarding(body: OnboardingInput): Promise<string | null> {
	try {
		const response = await fetch("/api/onboarding", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (response.ok) return null;
		const data = (await response.json().catch(() => ({}))) as { error?: string };
		return data.error ?? "We couldn't save that. Please try again.";
	} catch {
		return "We couldn't reach the server. Check your connection and try again.";
	}
}
