"use client";

import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCK_KIND_LABELS, type ExternalEvent, type ScheduleBlock } from "@/lib/focus/schemas";
import { formatDayLabel, formatTime, isSameDay, itemsOnDay } from "@/lib/focus/week";
import { BLOCK_TONES } from "./blockStyle";

type DayColumnProps = Readonly<{
	day: Date;
	blocks: readonly ScheduleBlock[];
	events: readonly ExternalEvent[];
	onAdd: (day: Date) => void;
	onEdit: (block: ScheduleBlock) => void;
	onDelete: (block: ScheduleBlock) => void;
}>;

function timeRange(startsAt: string, endsAt: string) {
	return `${formatTime(new Date(startsAt))} – ${formatTime(new Date(endsAt))}`;
}

function BlockItem({ block, onEdit, onDelete }: Readonly<{ block: ScheduleBlock; onEdit: () => void; onDelete: () => void }>) {
	return (
		<li
			className="group relative rounded-[var(--radius-sm)] border-l-4 bg-secondary/60 p-2 text-sm"
			style={{ borderLeftColor: BLOCK_TONES[block.kind] }}
		>
			<button type="button" onClick={onEdit} className="block w-full pr-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
				<span className="block font-medium leading-5">{block.title}</span>
				<span className="block text-xs text-muted-foreground">
					{BLOCK_KIND_LABELS[block.kind]} · {timeRange(block.starts_at, block.ends_at)}
				</span>
			</button>
			<button
				type="button"
				aria-label={`Delete ${block.title}`}
				onClick={onDelete}
				className="absolute right-1 top-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
			>
				<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
			</button>
		</li>
	);
}

function EventItem({ event }: Readonly<{ event: ExternalEvent }>) {
	return (
		<li className="rounded-[var(--radius-sm)] border border-dashed p-2 text-sm text-muted-foreground">
			<span className="flex items-center gap-1.5 font-medium leading-5">
				<CalendarDays className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
				{event.title}
			</span>
			<span className="block text-xs">{event.all_day ? "All day" : timeRange(event.starts_at, event.ends_at)} · Google Calendar</span>
		</li>
	);
}

export function DayColumn({ day, blocks, events, onAdd, onEdit, onDelete }: DayColumnProps) {
	const dayBlocks = itemsOnDay(blocks, day);
	const dayEvents = itemsOnDay(events, day);
	const label = formatDayLabel(day);
	const isToday = isSameDay(day, new Date());

	return (
		<section aria-label={label} className={cn("flex min-h-32 flex-col rounded-[var(--radius-md)] border bg-card p-3", isToday && "border-foreground/40")}>
			<header className="mb-2 flex items-center justify-between gap-2">
				<h3 className={cn("text-sm font-semibold", isToday && "text-[var(--cap-ink)]")}>{label}</h3>
				<button
					type="button"
					aria-label={`Add a block on ${label}`}
					onClick={() => onAdd(day)}
					className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<Plus className="h-4 w-4" aria-hidden="true" />
				</button>
			</header>
			<ul className="space-y-2">
				{dayBlocks.map((block) => (
					<BlockItem key={block.id} block={block} onEdit={() => onEdit(block)} onDelete={() => onDelete(block)} />
				))}
				{dayEvents.map((event) => (
					<EventItem key={event.id} event={event} />
				))}
			</ul>
		</section>
	);
}
