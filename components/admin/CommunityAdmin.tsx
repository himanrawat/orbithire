"use client";

// Admin controls for the invite-only community: the launch field, invite codes and the
// list of people waiting for an invite.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalDate } from "@/components/LocalDate";
import type { InviteRequestRow, InviteRow } from "@/lib/community/moderationServer";

async function send(url: string, method: string, body?: unknown) {
	const response = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as { error?: string } | null;
		throw new Error(data?.error ?? "Request failed");
	}
}

function message(error: unknown) {
	return error instanceof Error ? error.message : "Request failed";
}

function inviteStatus(invite: InviteRow): { label: string; variant: "success" | "secondary" | "destructive" } {
	if (invite.revoked_at) return { label: "Revoked", variant: "destructive" };
	if (invite.expires_at && new Date(invite.expires_at) < new Date()) return { label: "Expired", variant: "destructive" };
	if (invite.uses >= invite.max_uses) return { label: "Used up", variant: "secondary" };
	return { label: "Active", variant: "success" };
}

function LaunchFieldForm({ initial }: Readonly<{ initial: string }>) {
	const router = useRouter();
	const [value, setValue] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setStatus(null);
		try {
			await send("/api/admin/community/settings", "PATCH", { launchField: value.trim() });
			setStatus("Saved");
			router.refresh();
		} catch (error) {
			setStatus(message(error));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-3">
			<div className="min-w-[16rem] flex-1 space-y-1.5">
				<Label htmlFor="launch-field">Launch field (US)</Label>
				<Input id="launch-field" required minLength={2} maxLength={80} value={value} onChange={(event) => setValue(event.target.value)} />
			</div>
			<Button type="submit" disabled={busy}>
				{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
				Save
			</Button>
			{status && <output className="text-sm text-muted-foreground">{status}</output>}
		</form>
	);
}

function CreateInviteForm() {
	const router = useRouter();
	const [maxUses, setMaxUses] = useState("1");
	const [days, setDays] = useState("30");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			const expires = Number.parseInt(days, 10);
			await send("/api/admin/community/invites", "POST", {
				maxUses: Number.parseInt(maxUses, 10) || 1,
				expiresInDays: Number.isFinite(expires) && expires > 0 ? expires : null,
			});
			router.refresh();
		} catch (err) {
			setError(message(err));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={(event) => void submit(event)} className="flex flex-wrap items-end gap-3">
			<div className="w-32 space-y-1.5">
				<Label htmlFor="invite-uses">Uses</Label>
				<Input id="invite-uses" type="number" min={1} max={1000} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} />
			</div>
			<div className="w-40 space-y-1.5">
				<Label htmlFor="invite-days">Expires in (days)</Label>
				<Input id="invite-days" type="number" min={0} max={365} value={days} onChange={(event) => setDays(event.target.value)} />
			</div>
			<Button type="submit" variant="cap" disabled={busy}>
				{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
				Create invite
			</Button>
			{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
		</form>
	);
}

function InviteRowView({ invite }: Readonly<{ invite: InviteRow }>) {
	const router = useRouter();
	const [copied, setCopied] = useState(false);
	const status = inviteStatus(invite);

	async function copy() {
		try {
			await navigator.clipboard.writeText(invite.code);
			setCopied(true);
		} catch {
			setCopied(false);
		}
	}

	async function revoke() {
		try {
			await send(`/api/admin/community/invites?id=${invite.id}`, "DELETE");
			router.refresh();
		} catch (error) {
			console.error("Revoke failed:", error);
		}
	}

	return (
		<TableRow>
			<TableCell className="font-mono">{invite.code}</TableCell>
			<TableCell>{invite.field}</TableCell>
			<TableCell className="tabular-nums">
				{invite.uses} / {invite.max_uses}
			</TableCell>
			<TableCell>
				<Badge variant={status.variant}>{status.label}</Badge>
			</TableCell>
			<TableCell className="text-muted-foreground">
				{invite.expires_at ? <LocalDate value={invite.expires_at} /> : "Never"}
			</TableCell>
			<TableCell>
				<div className="flex gap-1">
					<Button type="button" variant="ghost" size="icon" aria-label={`Copy code ${invite.code}`} onClick={() => void copy()}>
						{copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
					</Button>
					{status.label === "Active" && (
						<Button type="button" variant="ghost" size="sm" onClick={() => void revoke()}>
							Revoke
						</Button>
					)}
				</div>
			</TableCell>
		</TableRow>
	);
}

function InvitesTable({ invites }: Readonly<{ invites: InviteRow[] }>) {
	if (invites.length === 0) return <p className="py-6 text-center text-muted-foreground">No invites yet. Create one above.</p>;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Code</TableHead>
					<TableHead>Field</TableHead>
					<TableHead>Used</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Expires</TableHead>
					<TableHead className="w-[140px]">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{invites.map((invite) => (
					<InviteRowView key={invite.id} invite={invite} />
				))}
			</TableBody>
		</Table>
	);
}

function RequestsList({ requests }: Readonly<{ requests: InviteRequestRow[] }>) {
	if (requests.length === 0) return <p className="text-sm text-muted-foreground">No one is waiting for an invite.</p>;
	return (
		<ul className="divide-y">
			{requests.map((request) => (
				<li key={request.user_id} className="py-3">
					<p className="text-sm font-medium">{request.email ?? request.user_id}</p>
					{request.note && <p className="text-sm text-muted-foreground">{request.note}</p>}
					<p className="text-xs text-muted-foreground">
						Requested <LocalDate value={request.created_at} />
					</p>
				</li>
			))}
		</ul>
	);
}

type CommunityAdminProps = Readonly<{
	launchField: string;
	memberCount: number;
	invites: InviteRow[];
	requests: InviteRequestRow[];
}>;

export function CommunityAdmin({ launchField, memberCount, invites, requests }: CommunityAdminProps) {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Launch field</CardTitle>
					<CardDescription>
						New invites default to this field. Members only see posts from their own field. {memberCount} active members.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<LaunchFieldForm initial={launchField} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Invites</CardTitle>
					<CardDescription>Share a code by email. Each code works until it expires or runs out of uses.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<CreateInviteForm />
					<InvitesTable invites={invites} />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Invite requests</CardTitle>
					<CardDescription>Oldest first. Send these people a code when a spot opens.</CardDescription>
				</CardHeader>
				<CardContent>
					<RequestsList requests={requests} />
				</CardContent>
			</Card>
		</div>
	);
}
