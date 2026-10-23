import "server-only";

// Stored Google Calendar connections. Tokens are encrypted at rest and only ever read with
// the service role; signed-in users can see their connection's email, never its tokens.

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptApiKey, encryptApiKey } from "@/lib/encryption";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { getGoogleClientConfig } from "./config";
import { GoogleAuthError, isExpiring, refreshAccessToken, revokeToken, type GoogleTokens } from "./oauth";

const PROVIDER = "google";

export type GoogleConnection = Readonly<{
	userId: string;
	accessToken: string;
	refreshToken: string | null;
	expiresAt: string | null;
	appCalendarId: string | null;
	email: string | null;
}>;

type ConnectionRow = {
	user_id: string;
	access_token_enc: string;
	refresh_token_enc: string | null;
	expires_at: string | null;
	app_calendar_id: string | null;
	email: string | null;
};

function toConnection(row: ConnectionRow): GoogleConnection {
	return {
		userId: row.user_id,
		accessToken: decryptApiKey(row.access_token_enc),
		refreshToken: row.refresh_token_enc ? decryptApiKey(row.refresh_token_enc) : null,
		expiresAt: row.expires_at,
		appCalendarId: row.app_calendar_id,
		email: row.email,
	};
}

/** Connected or not, and as which Google account. Reads through the user's own client (RLS). */
export async function getConnectionStatus(supabase: SupabaseClient, userId: string) {
	const { data } = await supabase
		.from("calendar_connections")
		.select("email, created_at")
		.eq("user_id", userId)
		.eq("provider", PROVIDER)
		.maybeSingle();
	return data ? { connected: true, email: (data.email as string | null) ?? null } : { connected: false, email: null };
}

export async function loadConnection(userId: string): Promise<GoogleConnection | null> {
	const { data, error } = await createServiceSupabase()
		.from("calendar_connections")
		.select("user_id, access_token_enc, refresh_token_enc, expires_at, app_calendar_id, email")
		.eq("user_id", userId)
		.eq("provider", PROVIDER)
		.maybeSingle();
	if (error || !data) return null;
	return toConnection(data as ConnectionRow);
}

export async function saveConnection(userId: string, tokens: GoogleTokens, email: string | null) {
	const row = {
		user_id: userId,
		provider: PROVIDER,
		access_token_enc: encryptApiKey(tokens.accessToken),
		refresh_token_enc: tokens.refreshToken ? encryptApiKey(tokens.refreshToken) : null,
		expires_at: tokens.expiresAt,
		scope: tokens.scope,
		email,
		updated_at: new Date().toISOString(),
	};
	const { error } = await createServiceSupabase()
		.from("calendar_connections")
		.upsert(row, { onConflict: "user_id,provider" });
	if (error) throw new Error("Could not save the calendar connection");
}

async function saveRefreshedTokens(userId: string, tokens: GoogleTokens) {
	await createServiceSupabase()
		.from("calendar_connections")
		.update({
			access_token_enc: encryptApiKey(tokens.accessToken),
			refresh_token_enc: tokens.refreshToken ? encryptApiKey(tokens.refreshToken) : null,
			expires_at: tokens.expiresAt,
			...(tokens.scope ? { scope: tokens.scope } : {}),
			updated_at: new Date().toISOString(),
		})
		.eq("user_id", userId)
		.eq("provider", PROVIDER);
}

export async function saveAppCalendarId(userId: string, calendarId: string) {
	await createServiceSupabase()
		.from("calendar_connections")
		.update({ app_calendar_id: calendarId, updated_at: new Date().toISOString() })
		.eq("user_id", userId)
		.eq("provider", PROVIDER);
}

export async function deleteConnection(userId: string) {
	const service = createServiceSupabase();
	await service.from("calendar_connections").delete().eq("user_id", userId).eq("provider", PROVIDER);
	// The pushed events lived on the app calendar, which the user keeps; unlink our copies.
	await service.from("schedule_blocks").update({ google_event_id: null }).eq("user_id", userId);
}

/**
 * The connection with a usable access token, refreshing it when it is about to expire.
 * A refresh the user revoked in Google removes the stale connection and returns null.
 */
export async function getActiveConnection(userId: string): Promise<GoogleConnection | null> {
	const config = getGoogleClientConfig();
	const connection = config ? await loadConnection(userId) : null;
	if (!config || !connection) return null;
	if (!isExpiring(connection.expiresAt, Date.now())) return connection;
	if (!connection.refreshToken) return null;
	try {
		const tokens = await refreshAccessToken(config, connection.refreshToken);
		await saveRefreshedTokens(userId, tokens);
		return { ...connection, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt };
	} catch (error) {
		if (error instanceof GoogleAuthError && error.code === "invalid_grant") await deleteConnection(userId);
		return null;
	}
}

/** Revokes the grant at Google (best effort) and deletes the stored tokens. */
export async function disconnectGoogle(userId: string) {
	const connection = await loadConnection(userId);
	const token = connection?.refreshToken ?? connection?.accessToken;
	if (token) await revokeToken(token);
	await deleteConnection(userId);
}
