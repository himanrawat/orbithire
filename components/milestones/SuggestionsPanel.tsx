"use client";

import { useState } from "react";
import { Check, Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	MILESTONE_KIND_LABELS,
	formatMilestoneDate,
	type MilestoneSuggestion,
	type SuggestionAction,
} from "@/lib/milestones/model";

function SuggestionRow({
	suggestion,
	onAct,
}: Readonly<{
	suggestion: MilestoneSuggestion;
	onAct: (id: string, action: SuggestionAction) => Promise<string | null>;
}>) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const act = async (action: SuggestionAction) => {
		setBusy(true);
		const failure = await onAct(suggestion.id, action);
		setBusy(false);
		setError(failure);
	};

	return (
		<li className="flex flex-wrap items-center justify-between gap-3 py-3">
			<div className="min-w-0">
				<p className="font-semibold leading-6">{suggestion.title}</p>
				<p className="text-xs text-muted-foreground">
					{MILESTONE_KIND_LABELS[suggestion.kind]} ·{" "}
					<time dateTime={suggestion.happened_on}>{formatMilestoneDate(suggestion.happened_on)}</time>
				</p>
				{error && (
					<output aria-live="polite" className="block text-sm text-destructive">
						{error}
					</output>
				)}
			</div>
			<div className="flex gap-2">
				<Button
					type="button"
					size="sm"
					disabled={busy}
					aria-label={`Add "${suggestion.title}" to your timeline`}
					onClick={() => void act("accept")}
				>
					<Check className="h-4 w-4" aria-hidden="true" />
					Add
				</Button>
				<Button
					type="button"
					size="sm"
					variant="ghost"
					disabled={busy}
					aria-label={`Dismiss "${suggestion.title}"`}
					onClick={() => void act("dismiss")}
				>
					<X className="h-4 w-4" aria-hidden="true" />
					Dismiss
				</Button>
			</div>
		</li>
	);
}

/** Suggested milestones from your activity. Hidden when there are none. */
export function SuggestionsPanel({
	suggestions,
	onAct,
}: Readonly<{
	suggestions: readonly MilestoneSuggestion[];
	onAct: (id: string, action: SuggestionAction) => Promise<string | null>;
}>) {
	if (suggestions.length === 0) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Lightbulb className="h-5 w-5" aria-hidden="true" />
					Suggested from your activity
				</CardTitle>
				<CardDescription>
					Offers, finished paths and learning you shared. Added milestones start private.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ul className="divide-y divide-border">
					{suggestions.map((suggestion) => (
						<SuggestionRow key={suggestion.id} suggestion={suggestion} onAct={onAct} />
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
