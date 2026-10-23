/** Shared types and limits for Learn (PRD v2, area 3). No server imports. */

export const ENTRY_KINDS = ["link", "note"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const VISIBILITIES = ["private", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const PROGRESS_STATUSES = ["in_progress", "done"] as const;
export type ProgressStatus = (typeof PROGRESS_STATUSES)[number];

export const LIBRARY_KINDS = ["guide", "link"] as const;
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

export const LEARN_LIMITS = {
	urlLength: 2048,
	titleLength: 300,
	noteLength: 5000,
	tags: 10,
	tagLength: 40,
	entriesPerPage: 100,
} as const;

export type LearningEntry = Readonly<{
	id: string;
	kind: EntryKind;
	url: string | null;
	title: string | null;
	note: string | null;
	tags: string[];
	visibility: Visibility;
	created_at: string;
}>;

export type PathSummary = Readonly<{
	id: string;
	slug: string;
	title: string;
	summary: string;
	stage: string | null;
	lessonCount: number;
	doneCount: number;
	totalMinutes: number;
}>;

export type LessonSummary = Readonly<{
	id: string;
	slug: string;
	title: string;
	minutes: number;
	sort: number;
	status: ProgressStatus | null;
}>;

export type LessonDetail = LessonSummary &
	Readonly<{
		body_md: string;
		path: Readonly<{ id: string; slug: string; title: string }>;
		previous: Readonly<{ slug: string; title: string }> | null;
		next: Readonly<{ slug: string; title: string }> | null;
	}>;

export type LibraryItem = Readonly<{
	id: string;
	slug: string;
	kind: LibraryKind;
	title: string;
	url: string | null;
	source_name: string | null;
	body_md: string | null;
	tags: string[];
	stage: string | null;
}>;

export type ActiveLesson = Readonly<{
	lessonId: string;
	lessonSlug: string;
	lessonTitle: string;
	minutes: number;
	pathSlug: string;
	pathTitle: string;
	href: string;
	startedAt: string | null;
}>;

export type ResourceLink = Readonly<{
	kind: "lesson" | "library";
	title: string;
	href: string;
	external: boolean;
}>;

export type SkillGap = Readonly<{
	skillId: string;
	label: string;
	/** how many of the top matches mention it */
	jobCount: number;
	resources: ResourceLink[];
}>;

export function lessonHref(pathSlug: string, lessonSlug: string) {
	return `/learn/paths/${pathSlug}/${lessonSlug}`;
}

export function libraryHref(item: Pick<LibraryItem, "kind" | "slug" | "url">) {
	if (item.kind === "link" && item.url) return item.url;
	return `/learn/library/${item.slug}`;
}

/** Trim, lowercase, collapse spaces, drop empties and duplicates, cap the count and length. */
export function normalizeTags(tags: readonly string[]): string[] {
	const out: string[] = [];
	for (const raw of tags) {
		const tag = raw.trim().toLowerCase().split(/\s+/).join(" ").slice(0, LEARN_LIMITS.tagLength);
		if (tag && !out.includes(tag)) out.push(tag);
		if (out.length >= LEARN_LIMITS.tags) break;
	}
	return out;
}
