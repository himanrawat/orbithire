/** Question bank filter state <-> query string. Pure, client-safe. */
import { PREP_STAGES, type CompanyType, type InterviewRound } from "./constants";
import type { QuestionFilters } from "./schema";

export type FilterState = Readonly<{
	role: string;
	topic: string;
	level: string;
	stage: string;
	companyType: string;
	mostAsked: boolean;
}>;

export const EMPTY_FILTERS: FilterState = {
	role: "",
	topic: "",
	level: "",
	stage: "",
	companyType: "",
	mostAsked: false,
};

const KEYS = ["role", "topic", "level", "stage", "companyType"] as const;

export function filtersToQuery(filters: FilterState | QuestionFilters): string {
	const params = new URLSearchParams();
	for (const key of KEYS) {
		const value = filters[key];
		if (value) params.set(key, value);
	}
	if (filters.mostAsked) params.set("mostAsked", "true");
	return params.toString();
}

export function activeFilterCount(filters: FilterState): number {
	return KEYS.filter((k) => filters[k] !== "").length + (filters.mostAsked ? 1 : 0);
}

/** Bank filters that match an interview card: its round as the stage, its company type. */
export function filtersForInterview(
	card: Readonly<{ round: InterviewRound; companyType: CompanyType | null }>
): FilterState {
	const stage = (PREP_STAGES as readonly string[]).includes(card.round) ? card.round : "";
	return { ...EMPTY_FILTERS, stage, companyType: card.companyType ?? "" };
}
