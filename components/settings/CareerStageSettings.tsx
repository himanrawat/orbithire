"use client";

// Settings → Account: "Career stage & goals" (PRD v2, area 1). Same fields as setup.

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GoalCheckboxes, StageRadios } from "@/components/onboarding/StageFields";
import { fetchOnboarding, saveOnboarding } from "@/components/onboarding/api";
import type { CareerStage } from "@/lib/onboarding/stages";

type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; message: string };

function SaveStatus({ state }: Readonly<{ state: SaveState }>) {
	if (state.status === "saved") {
		return (
			<output aria-live="polite" className="flex items-center gap-2 text-sm">
				<CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
				Saved
			</output>
		);
	}
	if (state.status === "error") {
		return (
			<output aria-live="polite" className="block text-sm text-destructive">
				{state.message}
			</output>
		);
	}
	return null;
}

export function CareerStageSettings() {
	const [stage, setStage] = useState<CareerStage | null>(null);
	const [goals, setGoals] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [state, setState] = useState<SaveState>({ status: "idle" });

	useEffect(() => {
		void fetchOnboarding().then((profile) => {
			setStage(profile?.career_stage ?? null);
			setGoals(profile?.goals ?? []);
			setLoading(false);
		});
	}, []);

	const save = async () => {
		setState({ status: "saving" });
		const failure = await saveOnboarding({ career_stage: stage, goals });
		setState(failure ? { status: "error", message: failure } : { status: "saved" });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Compass className="h-5 w-5" aria-hidden="true" />
					Career stage &amp; goals
				</CardTitle>
				<CardDescription>
					Your stage sets what NextMilestone puts first. Target role, locations and focus time live in{" "}
					<Link href="/onboarding" className="underline underline-offset-2">
						setup
					</Link>
					.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-6">
				{loading ? (
					<p className="flex items-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						Loading
					</p>
				) : (
					<>
						<StageRadios legend="Career stage" value={stage} onChange={setStage} />
						<GoalCheckboxes legend="Goals" stage={stage} value={goals} onChange={setGoals} />
						<div className="flex flex-wrap items-center gap-3">
							<Button type="button" onClick={() => void save()} disabled={state.status === "saving"}>
								{state.status === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
								Save stage &amp; goals
							</Button>
							<SaveStatus state={state} />
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
