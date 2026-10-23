"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/blocks";
import { cn } from "@/lib/utils";
import type { PlanItem } from "@/lib/today/nextStep";
import type { TodayPlan } from "@/lib/today/types";

type DailyPlanListProps = Readonly<{
	plan: TodayPlan | null;
	regenerating: boolean;
	onToggle: (id: string, done: boolean) => Promise<void>;
	onRegenerate: () => Promise<void>;
}>;

function PlanRow({
	item,
	onToggle,
}: Readonly<{ item: PlanItem; onToggle: (id: string, done: boolean) => Promise<void> }>) {
	const inputId = `plan-item-${item.id}`;
	return (
		<li className="flex items-start gap-3 rounded-[var(--radius-sm)] border bg-background/50 p-3">
			<input
				id={inputId}
				type="checkbox"
				checked={item.done}
				onChange={(e) => void onToggle(item.id, e.target.checked)}
				className="mt-0.5 h-5 w-5 flex-none cursor-pointer accent-[var(--success)]"
			/>
			<div className="min-w-0 flex-1">
				<label
					htmlFor={inputId}
					className={cn("block cursor-pointer font-medium", item.done && "text-muted-foreground line-through")}
				>
					{item.title}
				</label>
				<p className="text-sm text-muted-foreground">{item.reason}</p>
			</div>
			<Link
				href={item.href}
				className="flex-none text-sm font-medium text-[var(--info)] underline-offset-2 hover:underline"
				aria-label={`Open: ${item.title}`}
			>
				Open
			</Link>
		</li>
	);
}

function progressLabel(items: readonly PlanItem[]): string {
	const done = items.filter((i) => i.done).length;
	return `${done} of ${items.length} done`;
}

/** Today's plan of 3-5 items with check-off and an optional regenerate. */
export function DailyPlanList({ plan, regenerating, onToggle, onRegenerate }: DailyPlanListProps) {
	const items = plan?.items ?? [];
	return (
		<section id="plan" aria-labelledby="plan-heading" className="rounded-[var(--radius-md)] border bg-card p-5">
			<SectionHeader
				title={<span id="plan-heading">Today&apos;s plan</span>}
				description={items.length > 0 ? progressLabel(items) : "Your plan is on its way."}
				action={
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={regenerating}
						onClick={() => void onRegenerate()}
					>
						<RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} aria-hidden="true" />
						{regenerating ? "Refreshing…" : "Regenerate plan"}
					</Button>
				}
			/>
			{items.length > 0 && (
				<ul className="space-y-2">
					{items.map((item) => (
						<PlanRow key={item.id} item={item} onToggle={onToggle} />
					))}
				</ul>
			)}
		</section>
	);
}
