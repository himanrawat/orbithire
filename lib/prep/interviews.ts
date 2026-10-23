/** Interview card helpers: default checklists and checklist edits. Pure, client-safe. */
import type { ChecklistItem, InterviewCard, InterviewRound } from "./constants";

const COMMON_ITEMS = [
	"Confirm the time, time zone and video link",
	"Reread the job post and your resume",
	"Prepare three questions to ask them",
] as const;

const ROUND_ITEMS: Readonly<Record<InterviewRound, readonly string[]>> = {
	recruiter_screen: ["Practice your 90-second intro", "Know your salary range and start date"],
	technical_screen: ["Practice two JavaScript questions out loud", "Test your editor and screen share"],
	onsite: ["Practice one STAR story per value they list", "Plan breaks, water and a backup device"],
	system_design: ["Practice one design with requirements → API → data → scale", "Have a whiteboard tool ready"],
	hiring_manager: ["Prepare a story about a hard trade-off", "Research the team's recent launches"],
	other: ["Write down what this round covers"],
};

export const MAX_CHECKLIST_ITEMS = 20;

export function defaultChecklist(round: InterviewRound): ChecklistItem[] {
	return [...COMMON_ITEMS, ...ROUND_ITEMS[round]].map((label, index) => ({
		id: `c${index + 1}`,
		label,
		done: false,
	}));
}

export function toggleChecklistItem(
	items: readonly ChecklistItem[],
	id: string,
	done: boolean
): ChecklistItem[] {
	return items.map((item) => (item.id === id ? { ...item, done } : item));
}

export function checklistProgress(items: readonly ChecklistItem[]): { done: number; total: number } {
	return { done: items.filter((i) => i.done).length, total: items.length };
}

/** Interviews from `now` onward, soonest first. */
export function upcomingOnly(cards: readonly InterviewCard[], now: Date): InterviewCard[] {
	const t = now.getTime();
	return cards
		.filter((c) => new Date(c.scheduledAt).getTime() >= t)
		.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}
