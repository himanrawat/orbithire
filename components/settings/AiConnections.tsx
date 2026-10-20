"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Loader2, Plug, Plus, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Settings → AI connections: personal access tokens for the OrbitHire MCP
 * server (/api/mcp) and copy-paste setup for Claude Desktop / Claude Code.
 * Talks to GET/POST /api/settings/mcp-tokens and DELETE /api/settings/mcp-tokens/:id.
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

	useEffect(() => setOrigin(window.location.origin), []);
	const mcpUrl = `${origin || "https://your-orbithire-domain"}/api/mcp`;

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

	useEffect(() => {
		load();
	}, [load]);

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
						orbithire: {
							command: "npx",
							args: ["-y", "mcp-remote", mcpUrl, "--header", "Authorization:${ORBITHIRE_AUTH}"],
							env: { ORBITHIRE_AUTH: `Bearer ${tokenText}` },
						},
					},
				},
				null,
				2
			),
		[mcpUrl, tokenText]
	);
	const codeSnippet = `claude mcp add --transport http orbithire ${mcpUrl} --header "Authorization: Bearer ${tokenText}"`;

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
						Let Claude use your OrbitHire data: search your Job Inbox, tailor a resume or write a cover letter in your own
						Claude subscription, and save the result here as a new document with a PDF. Each app gets its own access
						token; revoke it any time.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
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
						<div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
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
							Needs Node.js (for <code>npx mcp-remote</code>). Then ask: “Tailor my resume for the top job in my OrbitHire
							inbox”.
						</p>
					</div>
					<div className="space-y-2">
						<CopyBlock label="Claude Code" text={codeSnippet} />
						<p className="text-xs text-muted-foreground">
							Run in a terminal, then use <code>/mcp</code> in Claude Code to check the connection.
						</p>
					</div>
					<div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
						<strong className="text-foreground">claude.ai and ChatGPT</strong> custom connectors sign in with OAuth instead
						of a pasted token. That login flow is coming in a later update; until then use Claude Desktop or Claude Code.
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
