import { BookMarked, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
	COMPANY_TYPE_LABELS,
	LEVEL_LABELS,
	SOURCE_LABELS,
	STAGE_LABELS,
	TOPIC_LABELS,
	type PrepQuestion,
} from "@/lib/prep/constants";

/** Topic, level, stages and the "Most asked" flag. */
export function QuestionTags({ question }: Readonly<{ question: PrepQuestion }>) {
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="Question tags">
			{question.mostAsked && (
				<li>
					<Badge variant="warning">Most asked</Badge>
				</li>
			)}
			<li>
				<Badge variant="prep">{TOPIC_LABELS[question.topic]}</Badge>
			</li>
			<li>
				<Badge variant="outline">{LEVEL_LABELS[question.level]}</Badge>
			</li>
			{question.stages.map((stage) => (
				<li key={stage}>
					<Badge variant="secondary">{STAGE_LABELS[stage]}</Badge>
				</li>
			))}
		</ul>
	);
}

/** Every question shows where it came from (PRD risk: "most asked" seen as invented). */
export function QuestionSource({ question }: Readonly<{ question: PrepQuestion }>) {
	const Icon = question.sourceKind === "user_reports" ? Users : BookMarked;
	const packs = question.companyTypes.map((t) => COMPANY_TYPE_LABELS[t]).join(", ");
	return (
		<p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
			<Icon className="h-3.5 w-3.5" aria-hidden="true" />
			<span>
				Source: {SOURCE_LABELS[question.sourceKind]} · {question.sourceNote}
			</span>
			{packs && <span>· Packs: {packs}</span>}
		</p>
	);
}
