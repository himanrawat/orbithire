"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { FOCUS_DURATIONS, MAX_TASK_LABEL, MAX_TASK_REF, type FocusDuration } from "@/lib/focus/timer";

type StartInput = Readonly<{ taskLabel: string; taskRef: string | null; plannedMinutes: FocusDuration }>;

/** ?task=…&ref=… lets Today's plan open the timer for one of its items. */
function readTaskFromUrl() {
	try {
		const params = new URLSearchParams(window.location.search);
		return {
			label: params.get("task")?.slice(0, MAX_TASK_LABEL) ?? "",
			ref: params.get("ref")?.slice(0, MAX_TASK_REF) ?? null,
		};
	} catch {
		return { label: "", ref: null };
	}
}

function durationClass(active: boolean) {
	return cn(
		"min-h-11 flex-1 rounded-[var(--radius-control)] border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
		active ? "border-foreground bg-foreground text-background" : "border-input bg-card hover:border-foreground/60"
	);
}

export function FocusStartForm({ onStart }: Readonly<{ onStart: (input: StartInput) => void }>) {
	const [label, setLabel] = useState("");
	const [taskRef, setTaskRef] = useState<string | null>(null);
	const [minutes, setMinutes] = useState<FocusDuration>(25);

	useEffect(() => {
		const fromUrl = readTaskFromUrl();
		if (fromUrl.label) setLabel(fromUrl.label);
		setTaskRef(fromUrl.ref);
	}, []);

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		onStart({ taskLabel: label, taskRef, plannedMinutes: minutes });
	};

	return (
		<form onSubmit={submit} className="space-y-5">
			<div className="space-y-2">
				<Label htmlFor="focus-task">What are you working on?</Label>
				<Input
					id="focus-task"
					value={label}
					maxLength={MAX_TASK_LABEL}
					required
					placeholder="e.g. System design: rate limiter"
					onChange={(event) => setLabel(event.target.value)}
				/>
			</div>
			<fieldset className="space-y-2">
				<legend className="text-sm font-medium">Length</legend>
				<div className="flex gap-2">
					{FOCUS_DURATIONS.map((value) => (
						<button
							key={value}
							type="button"
							aria-pressed={minutes === value}
							className={durationClass(minutes === value)}
							onClick={() => setMinutes(value)}
						>
							{value} min
						</button>
					))}
				</div>
			</fieldset>
			<Button type="submit" variant="cap" size="lg" className="w-full">
				<Play className="mr-2 h-4 w-4" aria-hidden="true" />
				Start focus
			</Button>
		</form>
	);
}
