"use client";

// The 4-step setup: stage → goals → target role, locations and optional resume import →
// weekly rhythm. Each Continue saves that step; every step and the whole setup can be skipped.

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { COMPLETION_COOKIE } from "@/lib/onboarding/stages";
import { stageDefaultsFor } from "@/lib/onboarding/stageDefaults";
import type { OnboardingInput, OnboardingProfile } from "@/lib/onboarding/schema";
import { fetchOnboarding, saveOnboarding } from "./api";
import {
	GoalsStep,
	RhythmStep,
	StageStep,
	TargetStep,
	type OnboardingDraft,
	type StepControls,
} from "./steps";

type StepComponent = ComponentType<
	StepControls & { draft: OnboardingDraft; update: (patch: Partial<OnboardingDraft>) => void }
>;

const STEPS: ReadonlyArray<{ label: string; Component: StepComponent }> = [
	{ label: "Stage", Component: StageStep },
	{ label: "Goals", Component: GoalsStep },
	{ label: "Target", Component: TargetStep },
	{ label: "Rhythm", Component: RhythmStep },
];

const EMPTY_DRAFT: OnboardingDraft = {
	career_stage: null,
	goals: [],
	target_role: "",
	target_locations: [],
	weekly_focus_hours: null,
};

function draftFrom(profile: OnboardingProfile | null): OnboardingDraft {
	if (!profile) return EMPTY_DRAFT;
	return {
		career_stage: profile.career_stage,
		goals: profile.goals,
		target_role: profile.target_role ?? "",
		target_locations: profile.target_locations,
		weekly_focus_hours: profile.weekly_focus_hours,
	};
}

/** What each step saves when the person continues. */
function stepPayload(step: number, draft: OnboardingDraft): OnboardingInput {
	switch (step) {
		case 0:
			return draft.career_stage ? { career_stage: draft.career_stage } : {};
		case 1:
			return { goals: draft.goals };
		case 2:
			return { target_role: draft.target_role.trim() || null, target_locations: draft.target_locations };
		default:
			return { weekly_focus_hours: draft.weekly_focus_hours ?? stageDefaultsFor(draft.career_stage).weeklyFocusHours };
	}
}

/** Remember in this browser that setup was shown, so the app never sends the person back. */
function markSetupShown() {
	document.cookie = `${COMPLETION_COOKIE}=1; path=/; max-age=31536000; samesite=lax`;
}

function ProgressSteps({ current }: Readonly<{ current: number }>) {
	return (
		<nav aria-label="Setup progress" className="mb-8">
			<p className="mb-3 text-sm font-semibold text-muted-foreground">
				Step {current + 1} of {STEPS.length}
			</p>
			<ol className="grid grid-cols-4 gap-2">
				{STEPS.map((step, index) => (
					<li key={step.label} aria-current={index === current ? "step" : undefined} className="grid gap-1.5">
						<span
							aria-hidden="true"
							className={cn("h-1.5 rounded-full", index <= current ? "bg-[var(--cap)]" : "bg-secondary")}
						/>
						<span className={cn("text-xs", index === current ? "font-semibold text-foreground" : "text-muted-foreground")}>
							{step.label}
							{index < current && <span className="sr-only"> (done)</span>}
						</span>
					</li>
				))}
			</ol>
		</nav>
	);
}

function useOnboardingFlow() {
	const router = useRouter();
	const [step, setStep] = useState(0);
	const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		markSetupShown();
		// Don't overwrite anything the person picked before the saved profile arrived.
		void fetchOnboarding().then((profile) =>
			setDraft((current) => (current === EMPTY_DRAFT ? draftFrom(profile) : current))
		);
	}, []);

	const update = useCallback((patch: Partial<OnboardingDraft>) => setDraft((current) => ({ ...current, ...patch })), []);

	const finish = useCallback(() => {
		router.push("/dashboard");
		router.refresh();
	}, [router]);

	const advance = useCallback(
		async (payload: OnboardingInput) => {
			const isLast = step === STEPS.length - 1;
			const body = isLast ? { ...payload, complete: true } : payload;
			setError(null);
			if (Object.keys(body).length > 0) {
				setBusy(true);
				const failure = await saveOnboarding(body);
				setBusy(false);
				if (failure) {
					setError(failure);
					return;
				}
			}
			if (isLast) finish();
			else setStep(step + 1);
		},
		[step, finish]
	);

	const skipAll = useCallback(async () => {
		setBusy(true);
		// Even if this save fails, the cookie set on arrival keeps the app from sending them back.
		await saveOnboarding({ complete: true });
		finish();
	}, [finish]);

	return {
		step,
		draft,
		busy,
		error,
		update,
		onContinue: () => void advance(stepPayload(step, draft)),
		onSkip: () => void advance({}),
		onBack: () => {
			setError(null);
			setStep(Math.max(0, step - 1));
		},
		onSkipAll: () => void skipAll(),
	};
}

export function OnboardingFlow() {
	const flow = useOnboardingFlow();
	const { Component } = STEPS[flow.step];
	return (
		<div className="w-full max-w-2xl">
			<div className="mb-2 flex justify-end">
				<button
					type="button"
					onClick={flow.onSkipAll}
					disabled={flow.busy}
					className="min-h-11 rounded-[var(--radius-sm)] px-2 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
				>
					Skip setup for now
				</button>
			</div>
			<ProgressSteps current={flow.step} />
			<Component
				key={flow.step}
				draft={flow.draft}
				update={flow.update}
				busy={flow.busy}
				error={flow.error}
				isFirst={flow.step === 0}
				isLast={flow.step === STEPS.length - 1}
				onContinue={flow.onContinue}
				onSkip={flow.onSkip}
				onBack={flow.onBack}
			/>
		</div>
	);
}
