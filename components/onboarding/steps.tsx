"use client";

// The four setup steps and the frame they share. Each step is its own form, so Enter
// continues; every step has "Skip this step".

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker } from "./LocationPicker";
import { ResumeImport } from "./ResumeImport";
import { GoalCheckboxes, StageRadios } from "./StageFields";
import { FOCUS_HOUR_OPTIONS, ONBOARDING_LIMITS, STAGE_INFO, type CareerStage } from "@/lib/onboarding/stages";
import { stageDefaultsFor } from "@/lib/onboarding/stageDefaults";

export type OnboardingDraft = {
	career_stage: CareerStage | null;
	goals: string[];
	target_role: string;
	target_locations: string[];
	weekly_focus_hours: number | null;
};

export type StepControls = Readonly<{
	busy: boolean;
	error: string | null;
	isFirst: boolean;
	isLast: boolean;
	onContinue: () => void;
	onSkip: () => void;
	onBack: () => void;
}>;

type StepProps = StepControls &
	Readonly<{
		draft: OnboardingDraft;
		update: (patch: Partial<OnboardingDraft>) => void;
	}>;

function StepFrame({
	title,
	description,
	children,
	busy,
	error,
	isFirst,
	isLast,
	onContinue,
	onSkip,
	onBack,
}: StepControls & Readonly<{ title: string; description: string; children: ReactNode }>) {
	const headingRef = useRef<HTMLHeadingElement>(null);
	useEffect(() => headingRef.current?.focus(), []);
	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onContinue();
	};
	return (
		<form onSubmit={submit} className="grid gap-6" noValidate>
			<div>
				<h1
					ref={headingRef}
					tabIndex={-1}
					className="font-display text-[28px] font-[680] leading-[34px] tracking-[-0.02em] focus:outline-none md:text-[32px] md:leading-[38px]"
				>
					{title}
				</h1>
				<p className="mt-1.5 text-[15px] leading-[22px] text-muted-foreground">{description}</p>
			</div>
			{children}
			{error && (
				<output aria-live="polite" className="block text-sm text-destructive">
					{error}
				</output>
			)}
			<div className="flex flex-wrap items-center gap-2 border-t pt-6">
				{!isFirst && (
					<Button type="button" variant="ghost" size="lg" onClick={onBack} disabled={busy}>
						<ArrowLeft className="h-4 w-4" aria-hidden="true" />
						Back
					</Button>
				)}
				<div className="ml-auto flex flex-wrap gap-2">
					<Button type="button" variant="outline" size="lg" onClick={onSkip} disabled={busy}>
						Skip this step
					</Button>
					<Button type="submit" variant="cap" size="lg" disabled={busy}>
						{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						{isLast ? "Finish" : "Continue"}
					</Button>
				</div>
			</div>
		</form>
	);
}

export function StageStep({ draft, update, ...controls }: StepProps) {
	return (
		<StepFrame
			{...controls}
			title="Where are you in your career?"
			description="Your stage sets what NextMilestone puts first. You can change it any time in Settings."
		>
			<StageRadios
				legend="Career stage"
				legendClassName="sr-only"
				value={draft.career_stage}
				onChange={(career_stage) => update({ career_stage })}
			/>
		</StepFrame>
	);
}

export function GoalsStep({ draft, update, ...controls }: StepProps) {
	const stagePrefix = draft.career_stage ? `Suggested for the ${STAGE_INFO[draft.career_stage].label} stage. ` : "";
	return (
		<StepFrame
			{...controls}
			title="What do you want to get done?"
			description={`${stagePrefix}Pick as many as fit, or add your own.`}
		>
			<GoalCheckboxes
				legend="Goals"
				legendClassName="sr-only"
				stage={draft.career_stage}
				value={draft.goals}
				onChange={(goals) => update({ goals })}
			/>
		</StepFrame>
	);
}

export function TargetStep({ draft, update, ...controls }: StepProps) {
	const roleId = useId();
	return (
		<StepFrame
			{...controls}
			title="What are you aiming for?"
			description="A target role and the places you'd work. We use them to rank jobs and tailor your plan."
		>
			<div className="grid gap-1.5">
				<Label htmlFor={roleId}>Target role</Label>
				<Input
					id={roleId}
					value={draft.target_role}
					maxLength={ONBOARDING_LIMITS.targetRoleLength}
					onChange={(event) => update({ target_role: event.target.value })}
					placeholder="e.g. Senior Product Designer"
					autoComplete="organization-title"
				/>
			</div>
			<fieldset className="grid gap-3">
				<legend className="mb-1 text-sm font-[550]">Where would you work?</legend>
				<LocationPicker value={draft.target_locations} onChange={(target_locations) => update({ target_locations })} />
			</fieldset>
			<details className="rounded-[var(--radius-md)] border bg-card">
				<summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">
					Import from your resume (optional)
				</summary>
				<div className="border-t p-4">
					<ResumeImport
						onSuggestRole={(role) => {
							if (!draft.target_role.trim()) update({ target_role: role });
						}}
					/>
				</div>
			</details>
		</StepFrame>
	);
}

function minutesPerWeekday(hours: number): number {
	return Math.round((hours * 60) / 5);
}

export function RhythmStep({ draft, update, ...controls }: StepProps) {
	const name = useId();
	const suggested = stageDefaultsFor(draft.career_stage).weeklyFocusHours;
	const hours = draft.weekly_focus_hours ?? suggested;
	return (
		<StepFrame
			{...controls}
			title="How much focus time each week?"
			description="A goal for focused work on your career: learning, prep or applications. No streaks, no guilt."
		>
			<fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-5">
				<legend className="sr-only">Weekly focus hours</legend>
				{FOCUS_HOUR_OPTIONS.map((option) => (
					<label
						key={option}
						className="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border bg-card p-3 text-center transition-colors hover:border-foreground/50 has-[:checked]:border-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
					>
						<input
							type="radio"
							name={name}
							value={option}
							checked={hours === option}
							onChange={() => update({ weekly_focus_hours: option })}
							className="sr-only"
						/>
						<span className="font-display text-2xl font-[680]">{option}</span>
						<span className="text-xs text-muted-foreground">hours</span>
						{option === suggested && <span className="mt-1 text-[11px] font-semibold text-muted-foreground">Suggested</span>}
					</label>
				))}
			</fieldset>
			<output aria-live="polite" className="block text-sm text-muted-foreground">
				{hours} hours a week is about {minutesPerWeekday(hours)} minutes each weekday.
			</output>
		</StepFrame>
	);
}
