import "server-only";

/**
 * Service-role reads and writes for the moderation queue and the admin Community page.
 * Callers must check the admin session first (requireAdmin / requireAdminPage).
 */
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { isMissingTableError } from "@/lib/adminModeration";
import { byId, planAction, toQueueReport, type QueueReport } from "./moderation";
import type { CreateInviteInput, ModerationAction } from "./schema";
import { DEFAULT_LAUNCH_FIELD, type ReportTarget } from "./types";

type Row = Record<string, unknown>;
type Db = SupabaseClient;

export const QUEUE_LIMIT = 50;

function service(): Db {
	return createServiceSupabase() as unknown as Db;
}

function targetIds(rows: readonly Row[], type: ReportTarget) {
	return [...new Set(rows.filter((row) => row.target_type === type).map((row) => String(row.target_id)))];
}

async function selectIn(db: Db, table: string, columns: string, key: string, ids: readonly string[]) {
	if (ids.length === 0) return [] as Row[];
	const { data } = await db.from(table).select(columns).in(key, ids as string[]);
	return (data ?? []) as unknown as Row[];
}

export type QueueResult = Readonly<{ reports: QueueReport[]; missingTable: boolean }>;

/** Open reports, newest first, with a preview of what was reported. */
export async function loadModerationQueue(): Promise<QueueResult> {
	const db = service();
	const { data, error } = await db
		.from("content_reports")
		.select("id, target_type, target_id, reason, details, status, created_at")
		.eq("status", "open")
		.order("created_at", { ascending: false })
		.limit(QUEUE_LIMIT);
	if (error) {
		if (!isMissingTableError(error)) console.error("Error fetching content reports:", error);
		return { reports: [], missingTable: isMissingTableError(error) };
	}
	const rows = (data ?? []) as Row[];
	const [posts, replies] = await Promise.all([
		selectIn(db, "community_posts", "id, author_id, title, body, hidden", "id", targetIds(rows, "post")),
		selectIn(db, "community_replies", "id, author_id, body, hidden", "id", targetIds(rows, "reply")),
	]);
	const memberIds = [
		...new Set([...targetIds(rows, "user"), ...posts.map((row) => String(row.author_id)), ...replies.map((row) => String(row.author_id))]),
	];
	const members = await selectIn(db, "community_members", "user_id, display_name, headline, status", "user_id", memberIds);
	const sources = { posts: byId(posts), replies: byId(replies), members: byId(members, "user_id") };
	const reports = rows.map((row) => toQueueReport(row, sources)).filter((report): report is QueueReport => report !== null);
	return { reports, missingTable: false };
}

type ReportRow = { id: string; target_type: ReportTarget; target_id: string; reason: string; status: string };

async function findAuthor(db: Db, report: ReportRow): Promise<string | null> {
	if (report.target_type === "user") return report.target_id;
	const table = report.target_type === "post" ? "community_posts" : "community_replies";
	const { data } = await db.from(table).select("author_id").eq("id", report.target_id).maybeSingle();
	return typeof data?.author_id === "string" ? data.author_id : null;
}

export type ModerationOutcome =
	| Readonly<{ ok: true; report: ReportRow; resolution: string; suspendedUserId: string | null }>
	| Readonly<{ ok: false; status: number; error: string }>;

async function closeReports(db: Db, report: ReportRow, adminId: string, plan: { status: string; resolution: string; closeAllForTarget: boolean }) {
	const update = { status: plan.status, resolution: plan.resolution, handled_by: adminId, handled_at: new Date().toISOString() };
	const query = db.from("content_reports").update(update).eq("status", "open");
	const scoped = plan.closeAllForTarget
		? query.eq("target_type", report.target_type).eq("target_id", report.target_id)
		: query.eq("id", report.id);
	const { error } = await scoped;
	if (error) throw new Error(error.message);
}

/** Hide, dismiss or suspend for one open report. Never touches a closed report. */
export async function applyModeration(reportId: string, action: ModerationAction, adminId: string, note?: string): Promise<ModerationOutcome> {
	const db = service();
	const { data } = await db
		.from("content_reports")
		.select("id, target_type, target_id, reason, status")
		.eq("id", reportId)
		.maybeSingle();
	const report = data as ReportRow | null;
	if (!report) return { ok: false, status: 404, error: "Report not found" };
	if (report.status !== "open") return { ok: false, status: 409, error: "This report was already handled" };

	const authorId = action === "suspend" ? await findAuthor(db, report) : null;
	const plan = planAction(action, { targetType: report.target_type, targetId: report.target_id }, authorId);
	if (!plan.ok) return { ok: false, status: 400, error: plan.error };

	const now = new Date().toISOString();
	if (plan.hide) {
		const { error } = await db.from(plan.hide.table).update({ hidden: true, hidden_at: now }).eq("id", plan.hide.id);
		if (error) throw new Error(error.message);
	}
	if (plan.suspendUserId) {
		const { error } = await db
			.from("community_members")
			.update({ status: "suspended", suspended_at: now, suspended_reason: note || `Report: ${report.reason}` })
			.eq("user_id", plan.suspendUserId);
		if (error) throw new Error(error.message);
	}
	await closeReports(db, report, adminId, plan);
	return { ok: true, report, resolution: plan.resolution, suspendedUserId: plan.suspendUserId };
}

// ==================== Admin Community page ====================

export type InviteRow = Readonly<{
	id: string;
	code: string;
	field: string;
	max_uses: number;
	uses: number;
	expires_at: string | null;
	revoked_at: string | null;
	created_at: string;
}>;

export type InviteRequestRow = Readonly<{ user_id: string; note: string | null; status: string; created_at: string; email: string | null }>;

export type CommunityAdminData = Readonly<{
	launchField: string;
	invites: InviteRow[];
	requests: InviteRequestRow[];
	memberCount: number;
	unavailable: boolean;
}>;

async function loadRequests(db: Db): Promise<InviteRequestRow[]> {
	const { data } = await db
		.from("community_invite_requests")
		.select("user_id, note, status, created_at")
		.eq("status", "pending")
		.order("created_at", { ascending: true })
		.limit(100);
	const rows = (data ?? []) as Row[];
	const profiles = byId(await selectIn(db, "profiles", "id, email", "id", rows.map((row) => String(row.user_id))));
	return rows.map((row) => {
		const email = profiles.get(String(row.user_id))?.email;
		return {
			user_id: String(row.user_id),
			note: typeof row.note === "string" ? row.note : null,
			status: String(row.status),
			created_at: String(row.created_at),
			email: typeof email === "string" ? email : null,
		};
	});
}

export async function loadCommunityAdmin(): Promise<CommunityAdminData> {
	const db = service();
	const [settings, invites, members, requests] = await Promise.all([
		db.from("community_settings").select("launch_field").eq("id", 1).maybeSingle(),
		db
			.from("community_invites")
			.select("id, code, field, max_uses, uses, expires_at, revoked_at, created_at")
			.order("created_at", { ascending: false })
			.limit(100),
		db.from("community_members").select("user_id", { count: "exact", head: true }).eq("status", "active"),
		loadRequests(db),
	]);
	if (settings.error || invites.error) {
		console.error("[admin/community] load failed:", settings.error ?? invites.error);
		return { launchField: DEFAULT_LAUNCH_FIELD, invites: [], requests: [], memberCount: 0, unavailable: true };
	}
	return {
		launchField: typeof settings.data?.launch_field === "string" ? settings.data.launch_field : DEFAULT_LAUNCH_FIELD,
		invites: (invites.data ?? []) as InviteRow[],
		requests,
		memberCount: members.count ?? 0,
		unavailable: false,
	};
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 10 characters from an alphabet without look-alikes (no 0/O, 1/I). */
export function generateInviteCode(length = 10) {
	const bytes = randomBytes(length);
	return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export async function createInvite(adminId: string, input: CreateInviteInput): Promise<InviteRow> {
	const db = service();
	const field = input.field ?? (await loadAdminLaunchField(db));
	const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null;
	const { data, error } = await db
		.from("community_invites")
		.insert({ code: generateInviteCode(), created_by: adminId, max_uses: input.maxUses, field, expires_at: expiresAt })
		.select("id, code, field, max_uses, uses, expires_at, revoked_at, created_at")
		.single();
	if (error) throw new Error(error.message);
	return data as InviteRow;
}

async function loadAdminLaunchField(db: Db) {
	const { data } = await db.from("community_settings").select("launch_field").eq("id", 1).maybeSingle();
	return typeof data?.launch_field === "string" ? data.launch_field : DEFAULT_LAUNCH_FIELD;
}

export async function revokeInvite(id: string) {
	const { data, error } = await service()
		.from("community_invites")
		.update({ revoked_at: new Date().toISOString() })
		.eq("id", id)
		.is("revoked_at", null)
		.select("id");
	if (error) throw new Error(error.message);
	return (data ?? []).length > 0;
}

export async function updateLaunchField(launchField: string) {
	const { error } = await service()
		.from("community_settings")
		.upsert({ id: 1, launch_field: launchField, updated_at: new Date().toISOString() });
	if (error) throw new Error(error.message);
}
