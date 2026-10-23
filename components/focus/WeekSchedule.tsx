"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/app/blocks";
import type { CreateBlockInput, ScheduleBlock } from "@/lib/focus/schemas";
import { addDays, formatWeekRange, startOfWeek, weekDays } from "@/lib/focus/week";
import { BlockDialog, type BlockDraft } from "./BlockDialog";
import { DayColumn } from "./DayColumn";
import { useWeekSchedule } from "./useWeekSchedule";

type GoogleState = Readonly<{ available: boolean; connected: boolean; error: string | null }>;

function GoogleNote({ google }: Readonly<{ google: GoogleState }>) {
	if (!google.available) return null;
	if (google.error) return <p className="text-sm text-[var(--danger)]">{google.error}</p>;
	if (google.connected) {
		return <p className="text-sm text-muted-foreground">Showing your Google Calendar. New blocks are added to a NextMilestone calendar there.</p>;
	}
	return (
		<p className="text-sm text-muted-foreground">
			<Link href="/settings?tab=integrations" className="font-medium text-[var(--info)] underline underline-offset-2">
				Connect Google Calendar
			</Link>{" "}
			to see your events here and add your blocks to it.
		</p>
	);
}

function WeekNav({ weekStart, onChange }: Readonly<{ weekStart: Date; onChange: (next: Date) => void }>) {
	return (
		<nav aria-label="Week" className="flex items-center gap-1">
			<Button type="button" variant="ghost" size="icon" aria-label="Previous week" onClick={() => onChange(addDays(weekStart, -7))}>
				<ChevronLeft className="h-4 w-4" aria-hidden="true" />
			</Button>
			<Button type="button" variant="outline" size="sm" onClick={() => onChange(startOfWeek(new Date()))}>
				This week
			</Button>
			<Button type="button" variant="ghost" size="icon" aria-label="Next week" onClick={() => onChange(addDays(weekStart, 7))}>
				<ChevronRight className="h-4 w-4" aria-hidden="true" />
			</Button>
		</nav>
	);
}

/** Monday-to-Sunday blocks by type: add, edit or move (change the day or time) and delete. */
export function WeekSchedule() {
	const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
	const [draft, setDraft] = useState<BlockDraft | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const schedule = useWeekSchedule(weekStart);
	const days = useMemo(() => weekDays(weekStart), [weekStart]);

	const save = async (input: CreateBlockInput, existing: ScheduleBlock | null) => {
		if (existing) await schedule.update(existing.id, input);
		else await schedule.create(input);
	};

	const remove = (block: ScheduleBlock) => {
		setActionError(null);
		schedule.remove(block.id).catch((err: unknown) => {
			setActionError(err instanceof Error ? err.message : "Could not delete the block");
		});
	};

	return (
		<section aria-labelledby="week-heading" className="space-y-4">
			<SectionHeader
				title={<span id="week-heading">Your week</span>}
				description={formatWeekRange(weekStart)}
				action={
					<Button type="button" size="sm" onClick={() => setDraft({ block: null, day: new Date() })}>
						<Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
						Add block
					</Button>
				}
				className="mb-0"
			/>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<WeekNav weekStart={weekStart} onChange={setWeekStart} />
				<GoogleNote google={schedule.google} />
			</div>
			<output aria-live="polite" className="block text-sm text-[var(--danger)]">
				{schedule.error ?? actionError}
			</output>
			<div aria-busy={schedule.loading} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
				{days.map((day) => (
					<DayColumn
						key={day.getTime()}
						day={day}
						blocks={schedule.blocks}
						events={schedule.events}
						onAdd={(d) => setDraft({ block: null, day: d })}
						onEdit={(block) => setDraft({ block, day: new Date(block.starts_at) })}
						onDelete={remove}
					/>
				))}
			</div>
			<BlockDialog draft={draft} onClose={() => setDraft(null)} onSave={save} />
		</section>
	);
}
