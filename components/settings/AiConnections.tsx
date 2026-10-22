"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Loader2, Plug, Plus, ShieldOff, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Settings → AI connections for the NextMilestone MCP server (/api/mcp):
 *  - apps connected with OAuth (claude.ai, ChatGPT): GET /api/oauth/grants,
 *    DELETE /api/oauth/grants/:id
 *  - personal access tokens (Claude Desktop / Claude Code): GET/POST
 *    /api/settings/mcp-tokens, DELETE /api/settings/mcp-tokens/:id
 *  - setup steps for each client.
 */

interface McpToken {
	id: string;
	name: string;
	token_prefix: string | null;
	scopes: string[];
	last_used_at: string | null;
	last_client: string | null;
	revoked_at: string | null;
	created_at: string;
}

interface OAuthGrant {
	id: string;
	client_id: string;
	client_name: string;
	redirect_host: string | null;
	scopes: string[];
	last_used_at: string | null;
	last_client: string | null;
	created_at: string;
}

function fmt(ts: string | null) {
	if (!ts) return "Never";
	return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function CopyBlock({ label, text }: { label: string; text: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm font-medium">{label}</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={async () => {
						try {
							await navigator.clipboard.writeText(text);
							setCopied(true);
							setTimeout(() => setCopied(false), 1500);
						} catch {
							/* clipboard blocked – user can select the text */
						}
					}}
				>
					{copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
					{copied ? "Copied" : "Copy"}
				</Button>
			</div>
			<pre className="max-w-full overflow-x-auto rounded-md border bg-muted/50 p-3 text-xs leading-relaxed">
				<code>{text}</code>
			</pre>
		</div>
	);
}

export function AiConnections({ className }: { className?: string }) {
	const [tokens, setTokens] = useState<McpToken[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [name, setName] = useState("Claude Desktop");
	const [canWrite, setCanWrite] = useState(true);
	const [creating, setCreating] = useState(false);
	const [revoking, setRevoking] = useState<string | null>(null);
	const [secret, setSecret] = useState<string | null>(null);
	const [origin, setOrigin] = useState("");
	const [grants, setGrants] = useState<OAuthGrant[]>([]);
	const [grantsLoading, setGrantsLoading] = useState(true);
	const [disconnecting, setDisconnecting] = useState<string | null>(null);

	useEffect(() => setOrigin(window.location.origin), []);
	const mcpUrl = `${origin || "https://your-nextmilestone-domain"}/api/mcp`;

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/settings/mcp-tokens", { cache: "no-store" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load tokens");
			setTokens(json.tokens || []);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load tokens");
		} finally {
			setLoading(false);
		}
	}, []);

	const loadGrants = useCallback(async () => {
		try {
			const res = await fetch("/api/oauth/grants", { cache: "no-store" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load connected apps");
			setGrants(json.grants || []);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load connected apps");
		} finally {
			setGrantsLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
		loadGrants();
	}, [load, loadGrants]);

	const disconnect = async (g: OAuthGrant) => {
		if (!window.confirm(`Disconnect ${g.client_name}? It loses access to NextMilestone immediately.`)) return;
		setDisconnecting(g.id);
		try {
			const res = await fetch(`/api/oauth/grants/${g.id}`, { method: "DELETE" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(json.error || "Failed to disconnect");
			await loadGrants();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to disconnect");
		} finally {
			setDisconnecting(null);
		}
	};

	const create = async () => {
		setCreating(true);
		setError(null);
		try {
			const res = await fetch("/api/settings/mcp-tokens", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, scopes: canWrite ? ["read", "write"] : ["read"] }),
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to create token");
			setSecret(json.secret);
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create token");
		} finally {
			setCreating(false);
		}
	};

	const revoke = async (id: string) => {
		if (!window.confirm("Revoke this token? Any app using it stops working immediately.")) return;
		setRevoking(id);
		try {
			const res = await fetch(`/api/settings/mcp-tokens/${id}`, { method: "DELETE" });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(json.error || "Failed to revoke token");
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to revoke token");
		} finally {
			setRevoking(null);
		}
	};

	const tokenText = secret || "orb_YOUR_TOKEN";
	const desktopSnippet = useMemo(
		() =>
			JSON.stringify(
				{
					mcpServers: {
						nextmilestone: {
							command: "npx",
							args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:${NEXTMILESTONE_AUTH}"],
							env: { NEXTMILESTONE_AUTH: `Bearer ${tokenText}` },
						},
					},
				},
				null,
				2
			),
		[mcpUrl, tokenText]
	);
	const codeSnippet = `claude mcp add --transport http nextmilestone ${mcpUrl} --header "Authorization: Bearer ${tokenText}"`;

	const active = tokens.filter((t) => !t.revoked_at);
	const revoked = tokens.filter((t) => t.revoked_at);

	return (
		<div className={cn("grid gap-6", className)}>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Plug className="h-5 w-5" />
						AI connections (MCP)
					</CardTitle>
					<CardDescription>
						Let Claude or ChatGPT use your NextMilestone data: search your Job Inbox, tailor a resume or write a cover letter
						in your own AI subscription, and save the result here as a new document with a PDF. claude.ai and ChatGPT
						connect by signing in to NextMilestone (OAuth); Claude Desktop and Claude Code use an access token. Disconnect or
						revoke any time.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="space-y-2">
						<p className="text-sm font-medium">Connected apps</p>
						{grantsLoading ? (
							<p className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" /> Loading…
							</p>
						) : grants.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No apps connected yet – see “Connect claude.ai” and “Connect ChatGPT” below.
							</p>
						) : (
							<ul className="divide-y rounded-lg border">
								{grants.map((g) => (
									<li key={g.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="min-w-0 space-y-0.5">
											<p className="truncate text-sm font-medium">
												{g.client_name}
												{g.redirect_host && (
													<span className="ml-1.5 text-xs font-normal text-muted-foreground">via {g.redirect_host}</span>
												)}
											</p>
											<p className="text-xs text-muted-foreground">
												{g.scopes.includes("write") ? "Read & write" : "Read only"} · Connected {fmt(g.created_at)} · Last
												used {fmt(g.last_used_at)}
												{g.last_client ? ` (${g.last_client})` : ""}
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => disconnect(g)}
											disabled={disconnecting === g.id}
										>
											{disconnecting === g.id ? (
												<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
											) : (
												<Unplug className="mr-1.5 h-3.5 w-3.5" />
											)}
											Disconnect
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>

					<div className="border-t pt-5">
						<p className="text-sm font-medium">Access tokens (Claude Desktop, Claude Code)</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
						<div className="space-y-2">
							<Label htmlFor="mcp-token-name">Token name</Label>
							<Input
								id="mcp-token-name"
								value={name}
								maxLength={80}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. Claude Desktop on my laptop"
							/>
						</div>
						<Button type="button" onClick={create} disabled={creating || !name.trim()}>
							{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
							Create token
						</Button>
					</div>
					<label className="flex items-start gap-2 text-sm">
						<input
							type="checkbox"
							className="mt-0.5"
							checked={canWrite}
							onChange={(e) => setCanWrite(e.target.checked)}
						/>
						<span>
							Allow saving (write scope): create resumes, cover letters and applications, and update application status.
							Without it the token can only read.
						</span>
					</label>

					{secret && (
						<div className="space-y-2 rounded-lg border border-[color-mix(in_srgb,var(--cap)_40%,transparent)] bg-[var(--cap-soft)] p-4">
							<p className="flex items-center gap-2 text-sm font-medium">
								<KeyRound className="h-4 w-4" />
								Copy your token now – it is shown only once.
							</p>
							<CopyBlock label="Access token" text={secret} />
							<Button type="button" variant="ghost" size="sm" onClick={() => setSecret(null)}>
								I have saved it
							</Button>
						</div>
					)}

					{error && (
						<p className="flex items-center gap-2 text-sm text-destructive">
							<AlertCircle className="h-4 w-4" />
							{error}
						</p>
					)}

					<div className="space-y-2">
						<p className="text-sm font-medium">Active tokens</p>
						{loading ? (
							<p className="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 className="h-4 w-4 animate-spin" /> Loading…
							</p>
						) : active.length === 0 ? (
							<p className="text-sm text-muted-foreground">No tokens yet.</p>
						) : (
							<ul className="divide-y rounded-lg border">
								{active.map((t) => (
									<li key={t.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
										<div className="min-w-0 space-y-0.5">
											<p className="truncate text-sm font-medium">
												{t.name}{" "}
												<code className="ml-1 rounded bg-muted px-1.5 py-0.5 text-xs">{t.token_prefix ?? "orb_"}…</code>
											</p>
											<p className="text-xs text-muted-foreground">
												{t.scopes.includes("write") ? "Read & write" : "Read only"} · Created {fmt(t.created_at)} · Last
												used {fmt(t.last_used_at)}
												{t.last_client ? ` (${t.last_client})` : ""}
											</p>
										</div>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => revoke(t.id)}
											disabled={revoking === t.id}
										>
											{revoking === t.id ? (
												<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
											) : (
												<ShieldOff className="mr-1.5 h-3.5 w-3.5" />
											)}
											Revoke
										</Button>
									</li>
								))}
							</ul>
						)}
						{revoked.length > 0 && (
							<p className="text-xs text-muted-foreground">
								{revoked.length} revoked token{revoked.length === 1 ? "" : "s"} (
								{revoked.map((t) => t.name).join(", ")}).
							</p>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-lg">Set up</CardTitle>
					<CardDescription>
						Server URL: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{mcpUrl}</code>
						{secret ? " – the snippets below already contain your new token." : " – replace orb_YOUR_TOKEN with your token."}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="space-y-2">
						<CopyBlock label="Claude Desktop – claude_desktop_config.json" text={desktopSnippet} />
						<p className="text-xs text-muted-foreground">
							Claude Desktop → Settings → Developer → Edit Config, merge this into the file, then restart Claude Desktop.
							Needs Node.js (for <code>npx mcp-remote</code>). Then ask: “Tailor my resume for the top job in my NextMilestone
							inbox”.
						</p>
					</div>
					<div className="space-y-2">
						<CopyBlock label="Claude Code" text={codeSnippet} />
						<p className="text-xs text-muted-foreground">
							Run in a terminal, then use <code>/mcp</code> in Claude Code to check the connection.
						</p>
					</div>
					<div className="space-y-2">
						<CopyBlock label="Connect claude.ai – connector URL" text={mcpUrl} />
						<ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
							<li>
								In claude.ai open <strong>Settings → Connectors</strong> and click <strong>Add custom connector</strong>{" "}
								(on Team/Enterprise plans an owner adds it under Organization settings → Connectors).
							</li>
							<li>
								Name it <em>NextMilestone</em>, paste the URL above, leave the advanced OAuth fields empty and click{" "}
								<strong>Add</strong>.
							</li>
							<li>
								Click <strong>Connect</strong>: you are sent here to sign in to NextMilestone and approve access (keep
								“write” ticked to let Claude save documents).
							</li>
							<li>In a chat, enable NextMilestone in the tools menu and ask: “Tailor my resume for the top job in my inbox”.</li>
						</ol>
					</div>
					<div className="space-y-2">
						<CopyBlock label="Connect ChatGPT – connector URL" text={mcpUrl} />
						<ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
							<li>
								In ChatGPT open <strong>Settings → Apps &amp; Connectors → Advanced settings</strong> and turn on{" "}
								<strong>Developer mode</strong> (Plus/Pro/Business plans).
							</li>
							<li>
								Back in <strong>Apps &amp; Connectors</strong> click <strong>Create</strong>: name <em>NextMilestone</em>, paste
								the URL above as the MCP server URL, choose <strong>OAuth</strong> as authentication, tick “I trust this
								application” and create it.
							</li>
							<li>Sign in to NextMilestone and approve access when ChatGPT opens the login window.</li>
							<li>
								In a new chat pick <strong>Developer mode</strong> from the + menu, enable NextMilestone and ask for your top
								jobs. ChatGPT asks you to confirm each write action.
							</li>
						</ol>
					</div>
					<p className="text-xs text-muted-foreground">
						Both need NextMilestone to be reachable over public HTTPS. Connected apps appear under “Connected apps” above.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
