"use client";

// Career stage radios and goal checkboxes, shared by the setup flow and Settings.

import { useId, useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
	CAREER_STAGES,
	ONBOARDING_LIMITS,
	STAGE_INFO,
	goalOptionsFor,
	toggleInList,
	type CareerStage,
} from "@/lib/onboarding/stages";

const optionClass =
	"flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border bg-card p-4 transition-colors hover:border-foreground/50 has-[:checked]:border-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring";

export function StageRadios({
	value,
	onChange,
	legend,
	legendClassName,
}: Readonly<{
	value: CareerStage | null;
	onChange: (stage: CareerStage) => void;
	legend: string;
	legendClassName?: string;
}>) {
	const name = useId();
	return (
		<fieldset className="grid gap-3">
			<legend className={cn("mb-3 text-sm font-[550]", legendClassName)}>{legend}</legend>
			{CAREER_STAGES.map((stage) => (
				<label key={stage} className={optionClass}>
					<input
						type="radio"
						name={name}
						value={stage}
						checked={value === stage}
						onChange={() => onChange(stage)}
						className="mt-1 h-4 w-4 flex-none accent-[var(--cap)]"
					/>
					<span className="min-w-0">
						<span className="block font-semibold">
							{STAGE_INFO[stage].label}
							<span className="ml-2 text-sm font-normal text-muted-foreground">{STAGE_INFO[stage].years}</span>
						</span>
						<span className="mt-0.5 block text-sm text-muted-foreground">{STAGE_INFO[stage].description}</span>
					</span>
				</label>
			))}
		</fieldset>
	);
}

function CustomGoalInput({ onAdd, disabled }: Readonly<{ onAdd: (goal: string) => void; disabled: boolean }>) {
	const id = useId();
	const [draft, setDraft] = useState("");
	const add = () => {
		const goal = draft.trim();
		if (!goal) return;
		onAdd(goal);
		setDraft("");
	};
	// Enter adds the goal instead of submitting the surrounding form.
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		add();
	};
	return (
		<div className="grid gap-1.5">
			<Label htmlFor={id}>Add your own goal</Label>
			<div className="flex gap-2">
				<Input
					id={id}
					value={draft}
					maxLength={ONBOARDING_LIMITS.goalLength}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={onKeyDown}
					placeholder="e.g. Move to a product role"
					disabled={disabled}
				/>
				<Button type="button" variant="outline" onClick={add} disabled={disabled || !draft.trim()} className="h-11">
					<Plus className="h-4 w-4" aria-hidden="true" />
					Add
				</Button>
			</div>
		</div>
	);
}

export function GoalCheckboxes({
	stage,
	value,
	onChange,
	legend,
	legendClassName,
}: Readonly<{
	stage: CareerStage | null;
	value: readonly string[];
	onChange: (goals: string[]) => void;
	legend: string;
	legendClassName?: string;
}>) {
	const max = ONBOARDING_LIMITS.goals;
	const atLimit = value.length >= max;
	const options = goalOptionsFor(stage, value);
	return (
		<div className="grid gap-4">
			<fieldset className="grid gap-2 sm:grid-cols-2">
				<legend className={cn("mb-3 text-sm font-[550]", legendClassName)}>{legend}</legend>
				{options.map((goal) => {
					const checked = value.includes(goal);
					return (
						<label key={goal} className={cn(optionClass, "items-center py-3", !checked && atLimit && "opacity-60")}>
							<input
								type="checkbox"
								checked={checked}
								disabled={!checked && atLimit}
								onChange={() => onChange(toggleInList(value, goal, max))}
								className="h-4 w-4 flex-none accent-[var(--cap)]"
							/>
							<span className="text-sm">{goal}</span>
						</label>
					);
				})}
			</fieldset>
			<CustomGoalInput
				disabled={atLimit}
				onAdd={(goal) => {
					if (!value.includes(goal)) onChange(toggleInList(value, goal, max));
				}}
			/>
			<output aria-live="polite" className="block text-sm text-muted-foreground">
				{value.length} of {max} goals chosen
			</output>
		</div>
	);
}
