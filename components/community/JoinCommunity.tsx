"use client";

// Shown to people who aren't members yet: redeem an invite code, or ask for one.
// The community is invite-only at launch, starting with one US field.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/app/blocks";
import { errorMessage, redeemInvite, requestInvite } from "@/lib/community/client";
import { COMMUNITY_LIMITS } from "@/lib/community/types";

function RedeemForm() {
	const router = useRouter();
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await redeemInvite(code);
			router.refresh();
		} catch (err) {
			setError(errorMessage(err, "Could not redeem this invite"));
			setBusy(false);
		}
	}

	return (
		<form onSubmit={(event) => void submit(event)} className="space-y-3">
			<div className="space-y-1.5">
				<Label htmlFor="invite-code">Invite code</Label>
				<Input
					id="invite-code"
					required
					autoComplete="off"
					maxLength={24}
					className="font-mono uppercase"
					placeholder="ABCD1234"
					value={code}
					onChange={(event) => setCode(event.target.value)}
				/>
			</div>
			<Button type="submit" variant="cap" disabled={busy}>
				{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
				Join the community
			</Button>
			{error && <output className="block text-sm text-[var(--danger)]">{error}</output>}
		</form>
	);
}

function RequestForm({ alreadyRequested }: Readonly<{ alreadyRequested: boolean }>) {
	const [note, setNote] = useState("");
	const [sent, setSent] = useState(alreadyRequested);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await requestInvite(note);
			setSent(true);
		} catch (err) {
			setError(errorMessage(err, "Could not send your request"));
		} finally {
			setBusy(false);
		}
	}

	if (sent) {
		return (
			<output className="block text-sm text-muted-foreground">
				You&apos;re on the list. We&apos;ll email you an invite when a spot opens.
			</output>
		);
	}
	return (
		<form onSubmit={(event) => void submit(event)} className="space-y-3">
			<div className="space-y-1.5">
				<Label htmlFor="invite-note">What would you like to get out of it? (optional)</Label>
				<Textarea
					id="invite-note"
					maxLength={COMMUNITY_LIMITS.requestNoteLength}
					placeholder="I'm moving from frontend to a staff role and want to hear from people who did it."
					value={note}
					onChange={(event) => setNote(event.target.value)}
				/>
			</div>
			<Button type="submit" variant="outline" disabled={busy}>
				{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
				Request an invite
			</Button>
			{error && <output className="block text-sm text-[var(--danger)]">{error}</output>}
		</form>
	);
}

export function JoinCommunity({
	launchField,
	suspended,
	alreadyRequested,
}: Readonly<{ launchField: string; suspended: boolean; alreadyRequested: boolean }>) {
	if (suspended) {
		return (
			<Card>
				<CardContent className="p-6 text-sm text-muted-foreground">
					Your community access is paused while a moderator reviews a report. Questions? Write to
					info@himanshurawat.in.
				</CardContent>
			</Card>
		);
	}
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Card>
				<CardContent className="p-6">
					<SectionHeader
						icon={<KeyRound aria-hidden="true" />}
						title="Have an invite?"
						description="Enter the code from your invite email."
					/>
					<RedeemForm />
				</CardContent>
			</Card>
			<Card>
				<CardContent className="p-6">
					<SectionHeader
						icon={<Mail aria-hidden="true" />}
						title="Request an invite"
						description={`We're opening in small groups, starting with ${launchField} in the US.`}
					/>
					<RequestForm alreadyRequested={alreadyRequested} />
				</CardContent>
			</Card>
		</div>
	);
}
