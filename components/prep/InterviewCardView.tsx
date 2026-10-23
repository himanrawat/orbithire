"use client";

import Link from "next/link";
import { CalendarClock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COMPANY_TYPE_LABELS, ROUND_LABELS, type InterviewCard } from "@/lib/prep/constants";
import { checklistProgress } from "@/lib/prep/interviews";

const WHEN_FORMAT = new Intl.DateTimeFormat("en-US", {
	weekday: "short",
	month: "short",
	day: "numeric",
	hour: "numeric",
	minute: "2-digit",
});

type InterviewCardViewProps = Readonly<{
	card: InterviewCard;
	highlighted: boolean;
	onToggle: (card: InterviewCard, itemId: string, done: boolean) => Promise<void>;
	onRemove: (id: string) => Promise<void>;
	onPractice: (card: InterviewCard) => void;
}>;

/** One interview linked to an application: date, round, checklist. */
export function InterviewCardView({ card, highlighted, onToggle, onRemove, onPractice }: InterviewCardViewProps) {
	const progress = checklistProgress(card.checklist);
	const headingId = `interview-${card.id}`;
	return (
		<article
			aria-labelledby={headingId}
			className={cn(
				"rounded-[var(--radius-md)] border bg-card p-4",
				highlighted && "border-[var(--kind-interview)] ring-2 ring-[var(--kind-interview-soft)]"
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 id={headingId} className="font-display text-base font-[650]">
						<Link href={`/companies/${card.companyId}`} className="hover:underline">
							{card.companyName}
						</Link>
					</h3>
					<p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
						<CalendarClock className="h-4 w-4 text-[var(--kind-interview)]" aria-hidden="true" />
						<time dateTime={card.scheduledAt}>{WHEN_FORMAT.format(new Date(card.scheduledAt))}</time>
					</p>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					aria-label={`Delete the ${card.companyName} interview`}
					onClick={() => void onRemove(card.id)}
				>
					<Trash2 className="h-4 w-4" aria-hidden="true" />
				</Button>
			</div>
			<div className="mt-2 flex flex-wrap gap-1.5">
				<Badge variant="interview">{ROUND_LABELS[card.round]}</Badge>
				{card.companyType && <Badge variant="outline">{COMPANY_TYPE_LABELS[card.companyType]}</Badge>}
			</div>
			<fieldset className="mt-3">
				<legend className="text-sm font-[550]">
					Checklist · {progress.done} of {progress.total} done
				</legend>
				<ul className="mt-2 space-y-1.5">
					{card.checklist.map((item) => (
						<li key={item.id}>
							<label className="flex items-start gap-2 text-sm">
								<input
									type="checkbox"
									className="mt-0.5 h-4 w-4 accent-[var(--cap)]"
									checked={item.done}
									onChange={(e) => void onToggle(card, item.id, e.target.checked)}
								/>
								<span className={cn(item.done && "text-muted-foreground line-through")}>{item.label}</span>
							</label>
						</li>
					))}
				</ul>
			</fieldset>
			<Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => onPractice(card)}>
				Practice questions for this round
			</Button>
		</article>
	);
}
