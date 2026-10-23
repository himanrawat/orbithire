/**
 * Profile and milestones (PRD area 7): shared types and pure helpers used by the API,
 * the owner's timeline and the public profile at /u/[handle].
 */

export const MILESTONE_KINDS = ["job", "promotion", "learning", "project", "certification", "talk", "other"] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export const MILESTONE_VISIBILITIES = ["private", "public"] as const;
export type MilestoneVisibility = (typeof MILESTONE_VISIBILITIES)[number];

export const MILESTONE_SOURCES = ["manual", "event", "suggested"] as const;
export type MilestoneSource = (typeof MILESTONE_SOURCES)[number];

export const SUGGESTION_ACTIONS = ["accept", "dismiss"] as const;
export type SuggestionAction = (typeof SUGGESTION_ACTIONS)[number];

export const MILESTONE_KIND_LABELS: Readonly<Record<MilestoneKind, string>> = {
	job: "New job",
	promotion: "Promotion",
	learning: "Learning",
	project: "Project",
	certification: "Certification",
	talk: "Talk",
	other: "Other",
};

/** Badge variants from components/ui/badge.tsx, one per kind. */
export const MILESTONE_KIND_BADGES = {
	job: "jobs",
	promotion: "warning",
	learning: "learn",
	project: "prep",
	certification: "success",
	talk: "interview",
	other: "secondary",
} as const satisfies Record<MilestoneKind, string>;

export const TITLE_MAX = 160;
export const DESCRIPTION_MAX = 2000;

export type Milestone = {
	id: string;
	kind: MilestoneKind;
	title: string;
	description: string | null;
	happened_on: string;
	visibility: MilestoneVisibility;
	source: MilestoneSource;
	source_ref: string | null;
	created_at: string;
};

export type MilestoneSuggestion = {
	id: string;
	kind: MilestoneKind;
	title: string;
	happened_on: string;
	source_ref: string;
};

/** Owner-only public profile settings. open_to_roles never leaves the owner's session. */
export type PublicProfileSettings = {
	public_handle: string | null;
	public_profile_enabled: boolean;
	search_indexing: boolean;
	open_to_roles: boolean;
};

export type PublicMilestone = Pick<Milestone, "id" | "kind" | "title" | "description" | "happened_on">;

/** A learning entry the owner shared to their profile (Learn, area 3). */
export type PublicLearningEntry = {
	id: string;
	title: string;
	url: string | null;
	note: string | null;
	tags: string[];
	created_at: string;
};

/** Exactly what /u/[handle] may render. */
export type PublicProfile = {
	handle: string;
	full_name: string | null;
	headline: string | null;
	search_indexing: boolean;
	milestones: PublicMilestone[];
	learning: PublicLearningEntry[];
};

export const MILESTONE_COLUMNS =
	"id, kind, title, description, happened_on, visibility, source, source_ref, created_at";
export const SUGGESTION_COLUMNS = "id, kind, title, happened_on, source_ref";
export const PUBLIC_SETTINGS_COLUMNS = "public_handle, public_profile_enabled, search_indexing, open_to_roles";

// ==================== Handles ====================

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
/** Same rule as profiles_public_handle_format_check. Linear: one bounded class per position. */
export const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
	"admin",
	"api",
	"app",
	"dashboard",
	"help",
	"info",
	"hello",
	"support",
	"settings",
	"signin",
	"signup",
	"login",
	"logout",
	"me",
	"profile",
	"root",
	"staff",
	"team",
	"nextmilestone",
	"orbithire",
	"security",
	"privacy",
	"terms",
	"about",
	"null",
	"undefined",
]);

export function normalizeHandle(value: string): string {
	return value.trim().toLowerCase();
}

/** Returns a reason the handle can't be used, or null when it's fine. */
export function handleProblem(value: string): string | null {
	const handle = normalizeHandle(value);
	if (handle.length < HANDLE_MIN || handle.length > HANDLE_MAX) {
		return `Use ${HANDLE_MIN} to ${HANDLE_MAX} characters.`;
	}
	if (!HANDLE_PATTERN.test(handle)) {
		return "Use lowercase letters, numbers and hyphens. Start and end with a letter or number.";
	}
	if (handle.includes("--")) return "Use one hyphen at a time.";
	if (RESERVED_HANDLES.has(handle)) return "That handle is reserved. Try another.";
	return null;
}

export function isValidHandle(value: string): boolean {
	return handleProblem(value) === null;
}

/** A starting handle from a name: "Jane Q. Doe" → "jane-q-doe". */
export function suggestHandle(name: string | null | undefined): string {
	const words = (name ?? "")
		.toLowerCase()
		.split(/[^a-z0-9]/)
		.filter((word) => word.length > 0);
	const handle = words.join("-").slice(0, HANDLE_MAX).replace(/-$/, "");
	return isValidHandle(handle) ? handle : "";
}

// ==================== Dates and grouping ====================

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
	if (!DATE_ONLY.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** "2026-03-14" → "Mar 2026". Formatted in UTC so a date never shifts a day. */
export function formatMilestoneDate(value: string): string {
	if (!isDateOnly(value)) return value;
	return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

type Dated = Readonly<{ happened_on: string }>;

export function sortByDateDesc<T extends Dated>(items: readonly T[]): T[] {
	return [...items].sort((a, b) => b.happened_on.localeCompare(a.happened_on));
}

/** Groups newest first by year: [["2026", [...]], ["2025", [...]]]. */
export function groupByYear<T extends Dated>(items: readonly T[]): [string, T[]][] {
	const groups = new Map<string, T[]>();
	for (const item of sortByDateDesc(items)) {
		const year = item.happened_on.slice(0, 4);
		const group = groups.get(year);
		if (group) group.push(item);
		else groups.set(year, [item]);
	}
	return [...groups.entries()];
}

/** What a visitor would see: public items only. */
export function publicOnly<T extends Readonly<{ visibility: MilestoneVisibility }>>(items: readonly T[]): T[] {
	return items.filter((item) => item.visibility === "public");
}

// ==================== Public profile ====================

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

function isKind(value: unknown): value is MilestoneKind {
	return typeof value === "string" && (MILESTONE_KINDS as readonly string[]).includes(value);
}

function toPublicMilestone(value: unknown): PublicMilestone | null {
	if (!isRecord(value)) return null;
	const { id, kind, title, description, happened_on } = value;
	if (typeof id !== "string" || typeof title !== "string" || typeof happened_on !== "string") return null;
	return {
		id,
		kind: isKind(kind) ? kind : "other",
		title,
		description: optionalText(description),
		happened_on,
	};
}

function safeUrl(value: unknown): string | null {
	if (typeof value !== "string") return null;
	return value.startsWith("https://") || value.startsWith("http://") ? value : null;
}

function toPublicLearning(value: unknown): PublicLearningEntry | null {
	if (!isRecord(value) || typeof value.id !== "string" || typeof value.created_at !== "string") return null;
	const url = safeUrl(value.url);
	const note = optionalText(value.note);
	const title = optionalText(value.title) ?? note ?? url;
	if (!title) return null;
	const tags = Array.isArray(value.tags) ? value.tags.filter((tag): tag is string => typeof tag === "string") : [];
	return { id: value.id, title, url, note: note === title ? null : note, tags, created_at: value.created_at };
}

function listOf<T>(value: unknown, parse: (item: unknown) => T | null): T[] {
	if (!Array.isArray(value)) return [];
	return value.map(parse).filter((item): item is T => item !== null);
}

/** Narrows learning_entries rows (or get_public_profile().learning) to public fields. */
export function parsePublicLearning(value: unknown): PublicLearningEntry[] {
	return listOf(value, toPublicLearning);
}

/**
 * Narrows get_public_profile() output to the allowed public fields. Anything else the
 * database returns (by mistake or later change) is dropped here, so it can't reach the page.
 */
export function parsePublicProfile(value: unknown): PublicProfile | null {
	if (!isRecord(value) || typeof value.handle !== "string") return null;
	return {
		handle: value.handle,
		full_name: optionalText(value.full_name),
		headline: optionalText(value.headline),
		search_indexing: value.search_indexing === true,
		milestones: listOf(value.milestones, toPublicMilestone),
		learning: parsePublicLearning(value.learning),
	};
}

/** Robots policy for a public profile: indexed only when the owner opted in. */
export function publicProfileRobots(profile: Readonly<Pick<PublicProfile, "search_indexing">> | null) {
	const allowed = profile?.search_indexing === true;
	return { index: allowed, follow: allowed };
}

export function publicProfilePath(handle: string): string {
	return `/u/${encodeURIComponent(handle)}`;
}

export function displayName(profile: Readonly<Pick<PublicProfile, "full_name" | "handle">>): string {
	return profile.full_name ?? profile.handle;
}
