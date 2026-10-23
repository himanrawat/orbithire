import { Lightbulb } from "lucide-react";
import type { PrepQuestion } from "@/lib/prep/constants";
import { frameworkForTopic } from "@/lib/prep/frameworks";

/** Optional framework hint (STAR; requirements → API → data → scale), closed by default. */
export function FrameworkHint({ question }: Readonly<{ question: PrepQuestion }>) {
	const framework = frameworkForTopic(question.topic);
	return (
		<details className="rounded-[var(--radius-md)] border bg-secondary/40 p-4">
			<summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
				<Lightbulb className="h-4 w-4 text-[var(--cap-ink)]" aria-hidden="true" />
				Show a framework hint: {framework.name}
			</summary>
			<ol className="mt-3 space-y-1.5 text-sm">
				{framework.steps.map((step, index) => (
					<li key={step.label}>
						<span className="font-semibold">
							{index + 1}. {step.label}:
						</span>{" "}
						<span className="text-muted-foreground">{step.detail}</span>
					</li>
				))}
			</ol>
			{question.frameworkHint && (
				<p className="mt-3 text-sm">
					<span className="font-semibold">For this question:</span> {question.frameworkHint}
				</p>
			)}
		</details>
	);
}
