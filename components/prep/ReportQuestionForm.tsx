"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClass } from "@/components/app/blocks";
import { COMPANY_TYPES, COMPANY_TYPE_LABELS } from "@/lib/prep/constants";
import { errorMessage, reportQuestion } from "./api";

type Status = { kind: "idle" } | { kind: "sent" } | { kind: "error"; message: string };

function buildReport(prompt: string, role: string, companyType: string) {
	return {
		prompt: prompt.trim(),
		...(role.trim() ? { role: role.trim() } : {}),
		...(companyType ? { companyType } : {}),
	};
}

function StatusLine({ status }: Readonly<{ status: Status }>) {
	if (status.kind === "sent") {
		return <output className="text-sm text-[var(--success)]">Thanks. We review reports before they join the bank.</output>;
	}
	if (status.kind === "error") return <output className="text-sm text-[var(--danger)]">{status.message}</output>;
	return null;
}

/** "I was asked this": users report real interview questions (research R7). */
export function ReportQuestionForm() {
	const [prompt, setPrompt] = useState("");
	const [role, setRole] = useState("");
	const [companyType, setCompanyType] = useState("");
	const [sending, setSending] = useState(false);
	const [status, setStatus] = useState<Status>({ kind: "idle" });

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSending(true);
		try {
			await reportQuestion(buildReport(prompt, role, companyType));
			setPrompt("");
			setStatus({ kind: "sent" });
		} catch (e) {
			setStatus({ kind: "error", message: errorMessage(e, "Could not send your report") });
		} finally {
			setSending(false);
		}
	}

	return (
		<details className="rounded-[var(--radius-md)] border bg-card p-5">
			<summary className="cursor-pointer font-display text-base font-[650]">Report a question you were asked</summary>
			<form className="mt-4 grid gap-3" onSubmit={(e) => void onSubmit(e)}>
				<label className="grid gap-1.5 text-sm font-[550]">
					The question
					<Textarea
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						minLength={10}
						maxLength={1000}
						required
						placeholder="e.g. Walk me through how you'd build a typeahead search."
					/>
				</label>
				<div className="grid gap-3 sm:grid-cols-2">
					<label className="grid gap-1.5 text-sm font-[550]">
						Role you interviewed for (optional)
						<Input value={role} onChange={(e) => setRole(e.target.value)} maxLength={120} placeholder="Senior frontend engineer" />
					</label>
					<label className="grid gap-1.5 text-sm font-[550]">
						Company type (optional)
						<select className={nativeSelectClass} value={companyType} onChange={(e) => setCompanyType(e.target.value)}>
							<option value="">Prefer not to say</option>
							{COMPANY_TYPES.map((t) => (
								<option key={t} value={t}>
									{COMPANY_TYPE_LABELS[t]}
								</option>
							))}
						</select>
					</label>
				</div>
				<p className="text-xs text-muted-foreground">Don&apos;t include the company&apos;s name or anything confidential.</p>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="submit" disabled={sending || prompt.trim().length < 10}>
						{sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						Send report
					</Button>
					<StatusLine status={status} />
				</div>
			</form>
		</details>
	);
}
