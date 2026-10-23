import type { LlmReasons } from "@/lib/jobs/types";

function ReasonList({ title, items }: Readonly<{ title: string; items: string[] }>) {
	if (items.length === 0) return null;
	return (
		<div>
			<p className="font-medium">{title}</p>
			<ul className="list-disc pl-5 text-xs text-muted-foreground">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</div>
	);
}

/** "What helped" / "What's missing" for a match score (written by the worker's ranking). */
export function ScoreExplanation({ explanation }: Readonly<{ explanation: LlmReasons["explanation"] }>) {
	const helped = explanation?.helped ?? [];
	const missing = explanation?.missing ?? [];
	if (helped.length === 0 && missing.length === 0) return null;
	return (
		<section aria-label="Score explanation" className="space-y-2">
			<ReasonList title="What helped" items={helped} />
			<ReasonList title="What's missing" items={missing} />
		</section>
	);
}
