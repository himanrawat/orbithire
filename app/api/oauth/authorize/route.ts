/**
 * Consent decision for /oauth/authorize (form POST).
 *
 * Checks: same-origin request, a valid signed consent payload (≤ 10 min old)
 * bound to the logged-in user. Approve → grant + single-use code, 303 to the
 * client's redirect_uri with code, state and iss (RFC 9207). Deny → 303 with
 * error=access_denied.
 */
import { NextResponse } from "next/server";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { issuerFor, requestHost } from "@/lib/oauth/config";
import { verifyConsent } from "@/lib/oauth/consent";
import { clientRedirect, createAuthorizationCode } from "@/lib/oauth/grants";
import { getClient } from "@/lib/oauth/clients";
import type { McpScope } from "@/lib/mcp/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function plainError(status: number, message: string) {
	return new NextResponse(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
	// CSRF: browsers send Origin on form POSTs; it must be this app.
	const origin = req.headers.get("origin");
	let originHost: string | null = null;
	try {
		originHost = origin && origin !== "null" ? new URL(origin).host.toLowerCase() : null;
	} catch {
		originHost = "invalid";
	}
	if (origin && originHost !== requestHost(req)) {
		return plainError(403, "Cross-site request refused.");
	}
	const site = req.headers.get("sec-fetch-site");
	if (site && site !== "same-origin" && site !== "none") {
		return plainError(403, "Cross-site request refused.");
	}

	let form: FormData;
	try {
		form = await req.formData();
	} catch {
		return plainError(400, "Invalid form submission.");
	}
	const consent = verifyConsent(form.get("consent")?.toString() ?? null);
	if (!consent) return plainError(400, "This authorization request expired. Start the connection again from your AI app.");

	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user || user.id !== consent.u) {
		return plainError(401, "Your OrbitHire session changed. Start the connection again from your AI app.");
	}

	const { r: request } = consent;
	const iss = issuerFor(req);
	const back = (params: Record<string, string | null>) =>
		NextResponse.redirect(clientRedirect(request.redirect_uri, { ...params, state: request.state, iss }), 303);

	if (form.get("decision") !== "approve") {
		return back({ error: "access_denied", error_description: "The user denied access" });
	}

	const scopes: McpScope[] = request.scopes.filter((s) => s !== "write" || form.get("scope_write") === "1");
	if (!scopes.includes("read")) scopes.unshift("read");

	try {
		const service = createServiceSupabase();
		const client = await getClient(service, request.client_id);
		if (!client) return plainError(400, "This application is no longer registered.");
		const code = await createAuthorizationCode(service, user.id, client, request, scopes);
		return back({ code });
	} catch (err) {
		console.error("[oauth] authorize failed:", err);
		return back({ error: "server_error", error_description: "Could not complete the authorization" });
	}
}
