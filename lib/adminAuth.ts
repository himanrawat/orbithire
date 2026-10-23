import "server-only";

import { isIP } from "net";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { createAdminSessionToken, hashAdminSessionToken } from "@/lib/adminSessionToken";
import { adminHomePath, hasMinRole, isAdminRole, type AdminRole } from "@/lib/adminRoles";

export type { AdminRole } from "@/lib/adminRoles";

const ADMIN_COOKIE = "admin_token";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const ROTATE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface AdminSession {
	id: string;
	email: string;
	name: string;
	role: AdminRole;
	password_hash: string;
	must_change_password: boolean;
}

export type RequireAdminOptions = {
	// Lowest role allowed. Defaults to `admin`, so moderators are opted in per route.
	minRole?: AdminRole;
	// Lets an admin who still has a temporary password reach the password change flow.
	allowPasswordChangePending?: boolean;
};

type AdminActivity = {
	targetType?: string;
	targetId?: string | null;
	details?: Record<string, unknown>;
	ipAddress?: string | null;
};

function normalizeOptions(options?: AdminRole | RequireAdminOptions): RequireAdminOptions {
	if (typeof options === "string") return { minRole: options };
	return options ?? {};
}

function setSessionCookie(token: string, expiresAt: Date) {
	cookies().set(ADMIN_COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		expires: expiresAt,
	});
}

function requestIp(req: NextRequest) {
	const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const rawIpAddress = forwardedFor || req.headers.get("x-real-ip") || "";
	return isIP(rawIpAddress) ? rawIpAddress : null;
}

export function clearAdminSessionCookie() {
	cookies().set(ADMIN_COOKIE, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		expires: new Date(0),
	});
}

// Audit trail for admin actions. Never throws: a logging failure must not undo the action.
export async function logAdminActivity(
	adminId: string,
	action: string,
	activity: AdminActivity = {}
) {
	const { error } = await createServiceSupabase().from("admin_activity_log").insert({
		admin_id: adminId,
		action,
		target_type: activity.targetType ?? "admin",
		target_id: activity.targetId ?? adminId,
		details: activity.details ?? {},
		ip_address: activity.ipAddress ?? null,
	});
	if (error) console.error(`Failed to log admin activity "${action}":`, error.message);
}

export async function createAdminSession(adminId: string, req: NextRequest) {
	const token = createAdminSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
	const ipAddress = requestIp(req);
	const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
	const supabase = createServiceSupabase();

	const { error } = await supabase.from("admin_sessions").insert({
		admin_id: adminId,
		token_hash: hashAdminSessionToken(token),
		expires_at: expiresAt.toISOString(),
		ip_address: ipAddress,
		user_agent: userAgent,
	});

	if (error) throw new Error(`Failed to create admin session: ${error.message}`);
	setSessionCookie(token, expiresAt);
	await logAdminActivity(adminId, "session_start", { ipAddress, details: { user_agent: userAgent } });
}

async function rotateSession(sessionId: string, tokenHash: string, now: Date) {
	const newToken = createAdminSessionToken();
	const newExpiry = new Date(now.getTime() + SESSION_LIFETIME_MS);
	const { data: rotated } = await createServiceSupabase()
		.from("admin_sessions")
		.update({
			token_hash: hashAdminSessionToken(newToken),
			expires_at: newExpiry.toISOString(),
			last_used_at: now.toISOString(),
			rotated_at: now.toISOString(),
		})
		.eq("id", sessionId)
		.eq("token_hash", tokenHash)
		.select("id")
		.maybeSingle();
	if (rotated) setSessionCookie(newToken, newExpiry);
}

// Looks up the hashed cookie token, then the admin. Returns null for a missing,
// expired or revoked session, an inactive admin, or a role below `minRole`.
export async function getAdminSession(
	minRole?: AdminRole,
	rotate = false
): Promise<AdminSession | null> {
	const token = cookies().get(ADMIN_COOKIE)?.value;
	if (!token) return null;

	const tokenHash = hashAdminSessionToken(token);
	const supabase = createServiceSupabase();
	const { data: session } = await supabase
		.from("admin_sessions")
		.select("id, admin_id, created_at, expires_at, rotated_at")
		.eq("token_hash", tokenHash)
		.is("revoked_at", null)
		.gt("expires_at", new Date().toISOString())
		.maybeSingle();

	if (!session) return null;

	const { data: admin } = await supabase
		.from("admin_users")
		.select("id, email, name, role, password_hash, must_change_password")
		.eq("id", session.admin_id)
		.eq("is_active", true)
		.maybeSingle();

	if (!admin || !isAdminRole(admin.role)) return null;
	if (minRole && !hasMinRole(admin.role, minRole)) return null;

	const now = new Date();
	const rotationBaseline = session.rotated_at || session.created_at;
	const shouldRotate =
		rotate && now.getTime() - new Date(rotationBaseline).getTime() >= ROTATE_AFTER_MS;

	if (shouldRotate) {
		await rotateSession(session.id, tokenHash, now);
	} else {
		await supabase
			.from("admin_sessions")
			.update({ last_used_at: now.toISOString() })
			.eq("id", session.id);
	}

	return { ...admin, must_change_password: admin.must_change_password === true } as AdminSession;
}

// Route-handler guard. Call it at the top of every app/api/admin/** and
// app/api/auth/admin/** handler. Accepts a role string for older callers.
export async function requireAdmin(options?: AdminRole | RequireAdminOptions) {
	const { minRole = "admin", allowPasswordChangePending = false } = normalizeOptions(options);
	const admin = await getAdminSession(minRole, true);
	if (!admin) return null;
	if (admin.must_change_password && !allowPasswordChangePending) return null;
	return admin;
}

// Server components can't set cookies, so pages read without rotating, once per request.
const getPageAdminSession = cache(() => getAdminSession(undefined, false));

// Page guard for app/admin/(dashboard)/**. Redirects instead of returning null.
export async function requireAdminPage(options?: AdminRole | RequireAdminOptions) {
	const { minRole = "admin", allowPasswordChangePending = false } = normalizeOptions(options);
	const admin = await getPageAdminSession();
	if (!admin) redirect("/admin/signin");
	if (admin.must_change_password && !allowPasswordChangePending) {
		redirect(adminHomePath(admin.role, true));
	}
	if (!hasMinRole(admin.role, minRole)) redirect(adminHomePath(admin.role, false));
	return admin;
}

export async function getAdminLayoutSession() {
	return getPageAdminSession();
}

export async function revokeCurrentAdminSession() {
	const token = cookies().get(ADMIN_COOKIE)?.value;
	if (token) {
		const { data: revoked } = await createServiceSupabase()
			.from("admin_sessions")
			.update({ revoked_at: new Date().toISOString() })
			.eq("token_hash", hashAdminSessionToken(token))
			.is("revoked_at", null)
			.select("admin_id")
			.maybeSingle();
		if (revoked?.admin_id) await logAdminActivity(revoked.admin_id, "session_end");
	}
	clearAdminSessionCookie();
}

export async function revokeAdminSessions(adminId: string, revokedBy: string = adminId) {
	await createServiceSupabase()
		.from("admin_sessions")
		.update({ revoked_at: new Date().toISOString() })
		.eq("admin_id", adminId)
		.is("revoked_at", null);
	await logAdminActivity(revokedBy, "sessions_revoked", { targetId: adminId });
}
