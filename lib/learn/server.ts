import "server-only";

/**
 * Server-side reads for Learn (PRD v2, area 3), all through the caller's RLS-scoped client.
 * Catalog tables (paths, path_lessons, library_items) are readable by every signed-in user;
 * learning_entries and path_progress only return the caller's own rows.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabaseServer";
import { getPlan, limitFor } from "@/lib/billing/plan";
import { buildPathAccess, startedPathOrder, type PathAccess } from "./access";
import { computeSkillGaps, type LessonRef } from "./skills";
import {
	LEARN_LIMITS,
	lessonHref,
	type ActiveLesson,
	type LearningEntry,
	type LessonDetail,
	type LessonSummary,
	type LibraryItem,
	type PathSummary,
	type ProgressStatus,
	type SkillGap,
} from "./types";

type Row = Record<string, unknown>;

/** How many top job matches feed the skill-gap card. */
export const SKILL_GAP_MATCHES = 20;

const ENTRY_COLUMNS = "id, kind, url, title, note, tags, visibility, created_at";
const LIBRARY_COLUMNS = "id, slug, kind, title, url, source_name, body_md, tags, stage";

function serverClient(): SupabaseClient {
	return createServerSupabase() as unknown as SupabaseClient;
}

function str(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function one(value: unknown): Row | null {
	if (Array.isArray(value)) return (value[0] as Row | undefined) ?? null;
	return value && typeof value === "object" ? (value as Row) : null;
}

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export async function loadEntries(supabase: SupabaseClient, userId: string): Promise<LearningEntry[]> {
	const { data, error } = await supabase
		.from("learning_entries")
		.select(ENTRY_COLUMNS)
		.eq("user_id", userId)
		.order("created_at", { ascending: false })
		.limit(LEARN_LIMITS.entriesPerPage);
	if (error) throw new Error(error.message);
	return (data ?? []) as LearningEntry[];
}

async function loadProgressMap(supabase: SupabaseClient, userId: string): Promise<Map<string, ProgressStatus>> {
	const { data } = await supabase.from("path_progress").select("lesson_id, status").eq("user_id", userId);
	return new Map((data ?? []).map((row: Row) => [String(row.lesson_id), row.status as ProgressStatus]));
}

function summarizePath(path: Row, lessons: Row[], progress: Map<string, ProgressStatus>): PathSummary {
	const own = lessons.filter((lesson) => lesson.path_id === path.id);
	return {
		id: String(path.id),
		slug: String(path.slug),
		title: String(path.title),
		summary: String(path.summary ?? ""),
		stage: str(path.stage),
		lessonCount: own.length,
		doneCount: own.filter((lesson) => progress.get(String(lesson.id)) === "done").length,
		totalMinutes: own.reduce((sum, lesson) => sum + Number(lesson.minutes ?? 0), 0),
	};
}

export async function loadPaths(supabase: SupabaseClient, userId: string): Promise<PathSummary[]> {
	const [paths, lessons, progress] = await Promise.all([
		supabase.from("paths").select("id, slug, title, summary, stage, sort").order("sort"),
		supabase.from("path_lessons").select("id, path_id, minutes"),
		loadProgressMap(supabase, userId),
	]);
	if (paths.error) throw new Error(paths.error.message);
	const lessonRows = (lessons.data ?? []) as Row[];
	return ((paths.data ?? []) as Row[]).map((path) => summarizePath(path, lessonRows, progress));
}

/** Which paths the user's plan opens (Free: the first path they started). */
export async function loadPathAccess(supabase: SupabaseClient, userId: string): Promise<PathAccess> {
	const ctx = await getPlan(userId, supabase);
	if (limitFor(ctx, "learning_paths") === null) return buildPathAccess(ctx, []);
	const { data, error } = await supabase
		.from("path_progress")
		.select("started_at, path_lessons(path_id)")
		.eq("user_id", userId);
	if (error) throw new Error(error.message);
	const rows = ((data ?? []) as Row[]).flatMap((row) => {
		const pathId = one(row.path_lessons)?.path_id;
		return pathId ? [{ pathId: String(pathId), startedAt: String(row.started_at ?? "") }] : [];
	});
	return buildPathAccess(ctx, startedPathOrder(rows));
}

export type PathDetail = Readonly<{ path: PathSummary; lessons: LessonSummary[] }>;

export async function loadPath(supabase: SupabaseClient, userId: string, slug: string): Promise<PathDetail | null> {
	const { data: path } = await supabase
		.from("paths")
		.select("id, slug, title, summary, stage")
		.eq("slug", slug)
		.maybeSingle();
	if (!path) return null;
	const [lessons, progress] = await Promise.all([
		supabase.from("path_lessons").select("id, path_id, slug, title, minutes, sort").eq("path_id", path.id).order("sort"),
		loadProgressMap(supabase, userId),
	]);
	const rows = (lessons.data ?? []) as Row[];
	return {
		path: summarizePath(path as Row, rows, progress),
		lessons: rows.map((row) => ({
			id: String(row.id),
			slug: String(row.slug),
			title: String(row.title),
			minutes: Number(row.minutes),
			sort: Number(row.sort),
			status: progress.get(String(row.id)) ?? null,
		})),
	};
}

function neighbor(lessons: readonly LessonSummary[], index: number) {
	const lesson = lessons[index];
	return lesson ? { slug: lesson.slug, title: lesson.title } : null;
}

export async function loadLesson(
	supabase: SupabaseClient,
	userId: string,
	pathSlug: string,
	lessonSlug: string
): Promise<LessonDetail | null> {
	const detail = await loadPath(supabase, userId, pathSlug);
	if (!detail) return null;
	const index = detail.lessons.findIndex((lesson) => lesson.slug === lessonSlug);
	if (index === -1) return null;
	const lesson = detail.lessons[index];
	const { data } = await supabase.from("path_lessons").select("body_md").eq("id", lesson.id).maybeSingle();
	return {
		...lesson,
		body_md: String(data?.body_md ?? ""),
		path: { id: detail.path.id, slug: detail.path.slug, title: detail.path.title },
		previous: neighbor(detail.lessons, index - 1),
		next: neighbor(detail.lessons, index + 1),
	};
}

export async function loadLibrary(supabase: SupabaseClient): Promise<LibraryItem[]> {
	const { data, error } = await supabase.from("library_items").select(LIBRARY_COLUMNS).order("kind").order("title");
	if (error) throw new Error(error.message);
	return ((data ?? []) as Row[]).map((row) => ({ ...(row as LibraryItem), tags: strings(row.tags) }));
}

export async function loadLibraryItem(supabase: SupabaseClient, slug: string): Promise<LibraryItem | null> {
	const { data } = await supabase.from("library_items").select(LIBRARY_COLUMNS).eq("slug", slug).maybeSingle();
	return data ? ({ ...(data as LibraryItem), tags: strings((data as Row).tags) }) : null;
}

async function loadTopJobTexts(supabase: SupabaseClient, userId: string): Promise<string[]> {
	const { data } = await supabase
		.from("job_matches")
		.select("llm_score, job_postings(title, description)")
		.eq("user_id", userId)
		.in("status", ["new", "shortlisted", "applied"])
		.order("llm_score", { ascending: false, nullsFirst: false })
		.limit(SKILL_GAP_MATCHES);
	return ((data ?? []) as Row[])
		.map((row) => one(row.job_postings))
		.filter((posting): posting is Row => posting !== null)
		.map((posting) => `${str(posting.title) ?? ""}\n${str(posting.description) ?? ""}`);
}

async function loadUserSkillSources(supabase: SupabaseClient, userId: string) {
	const { data } = await supabase
		.from("profiles")
		.select("skills, headline, experience_summary, extended_profile")
		.eq("id", userId)
		.maybeSingle();
	const row = (data ?? {}) as Row;
	const resumeText = [row.headline, row.experience_summary, row.extended_profile]
		.map((value) => (typeof value === "string" ? value : ""))
		.join("\n");
	return { profileSkills: strings(row.skills), resumeText };
}

async function loadLessonRefs(supabase: SupabaseClient): Promise<LessonRef[]> {
	const { data } = await supabase.from("path_lessons").select("slug, title, body_md, sort, paths(slug, sort)");
	return ((data ?? []) as Row[])
		.map((row) => ({ row, path: one(row.paths) }))
		.filter((entry) => entry.path !== null)
		.sort((a, b) => Number(a.path?.sort) - Number(b.path?.sort) || Number(a.row.sort) - Number(b.row.sort))
		.map(({ row, path }) => ({
			slug: String(row.slug),
			title: String(row.title),
			body_md: String(row.body_md ?? ""),
			pathSlug: String(path?.slug),
		}));
}

/** Top 5 skills the user's best matches ask for that their profile and resume don't show. */
export async function loadSkillGaps(
	supabase: SupabaseClient,
	userId: string,
	library: readonly LibraryItem[]
): Promise<{ gaps: SkillGap[]; matchCount: number }> {
	const [jobTexts, sources, lessons] = await Promise.all([
		loadTopJobTexts(supabase, userId),
		loadUserSkillSources(supabase, userId),
		loadLessonRefs(supabase),
	]);
	if (jobTexts.length === 0) return { gaps: [], matchCount: 0 };
	return { gaps: computeSkillGaps({ jobTexts, ...sources, lessons, library }), matchCount: jobTexts.length };
}

/**
 * The lesson the person started most recently and hasn't finished, or null. Used by
 * Today's next-step rule 3 ("continue your lesson"). Never throws.
 */
export async function getActiveLesson(userId: string, client?: SupabaseClient): Promise<ActiveLesson | null> {
	try {
		const supabase = client ?? serverClient();
		const { data, error } = await supabase
			.from("path_progress")
			.select("lesson_id, started_at, path_lessons(slug, title, minutes, paths(slug, title))")
			.eq("user_id", userId)
			.eq("status", "in_progress")
			.order("started_at", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (error || !data) return null;
		return toActiveLesson(data as Row);
	} catch {
		return null;
	}
}

function toActiveLesson(row: Row): ActiveLesson | null {
	const lesson = one(row.path_lessons);
	const path = one(lesson?.paths);
	const lessonSlug = str(lesson?.slug);
	const pathSlug = str(path?.slug);
	if (!lesson || !lessonSlug || !pathSlug) return null;
	return {
		lessonId: String(row.lesson_id),
		lessonSlug,
		lessonTitle: str(lesson.title) ?? "your lesson",
		minutes: Number(lesson.minutes ?? 10),
		pathSlug,
		pathTitle: str(path?.title) ?? "",
		href: lessonHref(pathSlug, lessonSlug),
		startedAt: str(row.started_at),
	};
}
