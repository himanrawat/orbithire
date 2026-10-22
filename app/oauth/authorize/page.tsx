/**
 * OAuth 2.1 authorization endpoint + consent screen.
 *
 * GET /oauth/authorize?response_type=code&client_id=…&redirect_uri=…
 *     &code_challenge=…&code_challenge_method=S256&scope=read+write&state=…&resource=…
 *
 * 1. Validate the request (unknown client / bad redirect URI → error page,
 *    anything else → error redirect to the client with state + iss).
 * 2. Require an NextMilestone login (→ /signin?redirect=back here).
 * 3. Show the consent form; it posts to /api/oauth/authorize with a signed,
 *    user-bound copy of the validated request.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createServerSupabase, createServiceSupabase } from "@/lib/supabaseServer";
import { AUTHORIZE_PATH, SCOPE_DESCRIPTIONS, issuerFor } from "@/lib/oauth/config";
import { validateAuthorizationRequest } from "@/lib/oauth/grants";
import { redirectHost } from "@/lib/oauth/clients";
import { signConsent } from "@/lib/oauth/consent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connect an app", robots: { index: false } };

type SearchParams = Record<string, string | string[] | undefined>;

function toParams(sp: SearchParams): URLSearchParams {
	const p = new URLSearchParams();
	for (const [k, v] of Object.entries(sp)) {
		if (Array.isArray(v)) v.forEach((x) => p.append(k, x));
		else if (v != null) p.append(k, v);
	}
	return p;
}

/** A Request carrying the incoming headers, for the origin helpers in lib/oauth/config. */
function currentRequest(query: string): Request {
	const h = headers();
	const host = h.get("x-forwarded-host") || h.get("host") || "localhost";
	const proto = h.get("x-forwarded-proto") || "http";
	return new Request(`${proto}://${host}${AUTHORIZE_PATH}${query ? `?${query}` : ""}`, { headers: new Headers(Array.from(h.entries())) });
}

function ErrorCard({ title, message }: { title: string; message: string }) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<ShieldAlert className="h-5 w-5 text-destructive" />
						{title}
					</CardTitle>
					<CardDescription>{message}</CardDescription>
				</CardHeader>
			</Card>
		</main>
	);
}

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
	const params = toParams(searchParams);
	const query = params.toString();
	const req = currentRequest(query);
	const service = createServiceSupabase();

	const result = await validateAuthorizationRequest(service, req, params, issuerFor(req));
	if (!result.ok && result.kind === "redirect") redirect(result.location);
	if (!result.ok) return <ErrorCard title={result.title} message={result.message} />;

	const supabase = createServerSupabase();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) {
		redirect(`/signin?redirect=${encodeURIComponent(`${AUTHORIZE_PATH}?${query}`)}`);
	}

	const { client, request } = result;
	const consent = signConsent(request, user.id, client.client_name);
	const verified = client.registration_type === "metadata_document";
	const clientHost = verified ? new URL(client.client_id).host : null;
	const wantsWrite = request.scopes.includes("write");

	return (
		<main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-xl">
						Connect <span className="break-words">{client.client_name}</span> to NextMilestone?
					</CardTitle>
					<CardDescription>
						Signed in as <strong className="text-foreground">{user.email}</strong>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form method="post" action="/api/oauth/authorize" className="space-y-5">
						<input type="hidden" name="consent" value={consent} />

						<div
							className={
								verified
									? "flex gap-2 rounded-lg border p-3 text-sm"
									: "flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--cap)_40%,transparent)] bg-[var(--cap-soft)] p-3 text-sm"
							}
						>
							{verified ? (
								<ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
							) : (
								<ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cap-ink)]" />
							)}
							<p>
								{verified ? (
									<>
										App identity published by <strong>{clientHost}</strong>.{" "}
									</>
								) : (
									<>The app registered itself; NextMilestone can&apos;t verify its name. </>
								)}
								After you approve, you&apos;ll be sent to{" "}
								<strong className="break-all">{redirectHost(request.redirect_uri)}</strong>. Only continue if you just
								added NextMilestone as a connector there.
							</p>
						</div>

						<fieldset className="space-y-3">
							<legend className="mb-2 text-sm font-medium">It will be able to:</legend>
							<label className="flex items-start gap-2 text-sm">
								<input type="checkbox" checked disabled className="mt-0.5" />
								<span>
									<strong>read</strong> – {SCOPE_DESCRIPTIONS.read}
								</span>
							</label>
							{wantsWrite && (
								<label className="flex items-start gap-2 text-sm">
									<input type="checkbox" name="scope_write" value="1" defaultChecked className="mt-0.5" />
									<span>
										<strong>write</strong> – {SCOPE_DESCRIPTIONS.write}. Untick to connect read-only.
									</span>
								</label>
							)}
						</fieldset>

						<p className="text-xs text-muted-foreground">
							You can disconnect it any time in Settings → AI connections. Nothing existing is overwritten: saved
							resumes and cover letters are always new documents.
						</p>

						<div className="flex justify-end gap-2">
							<button
								type="submit"
								name="decision"
								value="deny"
								className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
							>
								Cancel
							</button>
							<button
								type="submit"
								name="decision"
								value="approve"
								className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
							>
								Allow access
							</button>
						</div>
					</form>
				</CardContent>
			</Card>
		</main>
	);
}
