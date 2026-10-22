import "server-only";

import { isIP } from "net";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { createAdminSessionToken, hashAdminSessionToken } from "@/lib/adminSessionToken";

const ADMIN_COOKIE = "admin_token";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const ROTATE_AFTER_MS = 24 * 60 * 60 * 1000;

export type AdminRole = "admin" | "super_admin";

export interface AdminSession {
	id: string;
	email: string;
	name: string;
	role: AdminRole;
	password_hash: string;
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

export function clearAdminSessionCookie() {
	cookies().set(ADMIN_COOKIE, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		expires: new Date(0),
	});
}

export async function createAdminSession(adminId: string, req: NextRequest) {
	const token = createAdminSessionToken();
	const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
	const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	const rawIpAddress = forwardedFor || req.headers.get("x-real-ip") || "";
	const ipAddress = isIP(rawIpAddress) ? rawIpAddress : null;
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
}

export async function getAdminSession(
	requiredRole?: AdminRole,
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
		.select("id, email, name, role, password_hash")
		.eq("id", session.admin_id)
		.eq("is_active", true)
		.maybeSingle();

	if (!admin || (requiredRole && admin.role !== requiredRole)) return null;

	const now = new Date();
	const rotationBaseline = session.rotated_at || session.created_at;
	const shouldRotate =
		rotate && now.getTime() - new Date(rotationBaseline).getTime() >= ROTATE_AFTER_MS;

	if (shouldRotate) {
		const newToken = createAdminSessionToken();
		const newExpiry = new Date(now.getTime() + SESSION_LIFETIME_MS);
		const { data: rotated } = await supabase
			.from("admin_sessions")
			.update({
				token_hash: hashAdminSessionToken(newToken),
				expires_at: newExpiry.toISOString(),
				last_used_at: now.toISOString(),
				rotated_at: now.toISOString(),
			})
			.eq("id", session.id)
			.eq("token_hash", tokenHash)
			.select("id")
			.maybeSingle();
		if (rotated) setSessionCookie(newToken, newExpiry);
	} else {
		await supabase
			.from("admin_sessions")
			.update({ last_used_at: now.toISOString() })
			.eq("id", session.id);
	}

	return admin as AdminSession;
}

export async function requireAdmin(requiredRole?: AdminRole) {
	return getAdminSession(requiredRole, true);
}

export async function revokeCurrentAdminSession() {
	const token = cookies().get(ADMIN_COOKIE)?.value;
	if (token) {
		await createServiceSupabase()
			.from("admin_sessions")
			.update({ revoked_at: new Date().toISOString() })
				.eq("token_hash", hashAdminSessionToken(token))
			.is("revoked_at", null);
	}
	clearAdminSessionCookie();
}

export async function revokeAdminSessions(adminId: string) {
	await createServiceSupabase()
		.from("admin_sessions")
		.update({ revoked_at: new Date().toISOString() })
		.eq("admin_id", adminId)
		.is("revoked_at", null);
}
