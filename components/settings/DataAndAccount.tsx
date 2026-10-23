"use client";

import { useId, useState, type FormEvent } from "react";
import { Download, FileText, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearOfflinePages } from "@/lib/pwa/client";

type DeleteState =
	| { status: "idle" }
	| { status: "deleting" }
	| { status: "error"; message: string };

async function requestAccountDeletion(confirmEmail: string): Promise<string | null> {
	try {
		const response = await fetch("/api/account/delete", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ confirmEmail }),
		});
		if (response.ok) {
			// The account is gone and signed out: drop the offline page shells too.
			clearOfflinePages();
			return null;
		}
		const data = (await response.json().catch(() => ({}))) as { error?: string };
		return data.error ?? "We couldn't delete your account. Please try again.";
	} catch {
		return "We couldn't reach the server. Check your connection and try again.";
	}
}

function ExportCard() {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Download className="h-5 w-5" aria-hidden="true" />
					Download your data
				</CardTitle>
				<CardDescription>
					A full copy of what we store about you: profile, applications, documents, job searches, settings and
					the AI generation log. Saved API keys and access tokens are left out.
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-3">
				<Button asChild variant="outline">
					<a href="/api/account/export?format=json" download>
						<Download className="mr-2 h-4 w-4" aria-hidden="true" />
						Download JSON
					</a>
				</Button>
				<Button asChild variant="outline">
					<a href="/api/account/export?format=html" target="_blank" rel="noopener noreferrer">
						<FileText className="mr-2 h-4 w-4" aria-hidden="true" />
						Printable summary (save as PDF)
					</a>
				</Button>
			</CardContent>
		</Card>
	);
}

function DeleteError({ state }: Readonly<{ state: DeleteState }>) {
	if (state.status !== "error") return null;
	return (
		<p role="alert" className="rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
			{state.message}
		</p>
	);
}

function DeleteAccountCard() {
	const inputId = useId();
	const [confirmEmail, setConfirmEmail] = useState("");
	const [state, setState] = useState<DeleteState>({ status: "idle" });
	const deleting = state.status === "deleting";

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setState({ status: "deleting" });
		const error = await requestAccountDeletion(confirmEmail);
		if (error) {
			setState({ status: "error", message: error });
			return;
		}
		window.location.assign("/");
	}

	return (
		<Card className="border-destructive/50">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg text-destructive">
					<Trash2 className="h-5 w-5" aria-hidden="true" />
					Delete your account
				</CardTitle>
				<CardDescription>
					This permanently deletes your account, profile, applications, documents, PDFs and settings. It
					can&apos;t be undone. Download your data first if you want a copy.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
					<fieldset disabled={deleting} className="space-y-2">
						<legend className="sr-only">Confirm account deletion</legend>
						<Label htmlFor={inputId}>Type the email you sign in with to confirm</Label>
						<Input
							id={inputId}
							type="email"
							autoComplete="off"
							value={confirmEmail}
							onChange={(event) => setConfirmEmail(event.target.value)}
							placeholder="you@example.com"
							required
						/>
					</fieldset>
					<DeleteError state={state} />
					<Button type="submit" variant="destructive" disabled={deleting || confirmEmail.trim() === ""}>
						{deleting ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						) : (
							<Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
						)}
						Delete my account
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

/** Settings → Data & privacy: self-serve export and account deletion (PRD area 11). */
export function DataAndAccount() {
	return (
		<div className="grid gap-6">
			<ExportCard />
			<DeleteAccountCard />
		</div>
	);
}
