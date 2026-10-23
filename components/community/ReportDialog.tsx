"use client";

// Report a post, reply or member to the moderators.

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, reportContent } from "@/lib/community/client";
import {
	COMMUNITY_LIMITS,
	REPORT_REASON_LABELS,
	REPORT_REASONS,
	type ReportReason,
	type ReportTarget,
} from "@/lib/community/types";

type ReportDialogProps = Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	targetType: ReportTarget;
	targetId: string;
}>;

const TARGET_NOUN: Readonly<Record<ReportTarget, string>> = { post: "post", reply: "reply", user: "member" };

function ReasonPicker({ value, onChange }: Readonly<{ value: ReportReason; onChange: (reason: ReportReason) => void }>) {
	return (
		<fieldset className="space-y-2">
			<legend className="mb-2 text-sm font-medium">Reason</legend>
			{REPORT_REASONS.map((reason) => (
				<label key={reason} className="flex min-h-9 items-center gap-2 text-sm">
					<input
						type="radio"
						name="report-reason"
						value={reason}
						checked={value === reason}
						onChange={() => onChange(reason)}
					/>
					{REPORT_REASON_LABELS[reason]}
				</label>
			))}
		</fieldset>
	);
}

export function ReportDialog({ open, onOpenChange, targetType, targetId }: ReportDialogProps) {
	const [reason, setReason] = useState<ReportReason>("spam");
	const [details, setDetails] = useState("");
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await reportContent(targetType, targetId, reason, details);
			setDone(true);
		} catch (err) {
			setError(errorMessage(err, "Could not send your report"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Report this {TARGET_NOUN[targetType]}</DialogTitle>
					<DialogDescription>A moderator reviews every report. The author isn&apos;t told who reported it.</DialogDescription>
				</DialogHeader>
				{done ? (
					<output className="block text-sm">Thanks. A moderator will take a look.</output>
				) : (
					<form onSubmit={(event) => void submit(event)} className="space-y-4">
						<ReasonPicker value={reason} onChange={setReason} />
						<div className="space-y-1.5">
							<Label htmlFor={`report-details-${targetId}`}>Anything else? (optional)</Label>
							<Textarea
								id={`report-details-${targetId}`}
								maxLength={COMMUNITY_LIMITS.reportDetailsLength}
								value={details}
								onChange={(event) => setDetails(event.target.value)}
							/>
						</div>
						<div className="flex items-center gap-3">
							<Button type="submit" variant="destructive" disabled={busy}>
								{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
								Send report
							</Button>
							{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
