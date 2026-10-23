"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nativeSelectClass } from "@/components/app/blocks";
import {
	COMPANY_TYPES,
	COMPANY_TYPE_LABELS,
	INTERVIEW_ROUNDS,
	ROUND_LABELS,
	type InterviewRound,
} from "@/lib/prep/constants";
import { errorMessage, type CompanyOption } from "./api";

type AddInterviewFormProps = Readonly<{
	companies: readonly CompanyOption[];
	onAdd: (body: Record<string, unknown>) => Promise<void>;
	onDone: () => void;
}>;

function toIso(local: string): string | null {
	const date = new Date(local);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function AddInterviewForm({ companies, onAdd, onDone }: AddInterviewFormProps) {
	const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
	const [when, setWhen] = useState("");
	const [round, setRound] = useState<InterviewRound>("technical_screen");
	const [companyType, setCompanyType] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (companies.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">
				Add the application first in{" "}
				<Link href="/companies" className="font-medium text-[var(--info)] underline underline-offset-2">
					Companies
				</Link>
				, then link an interview to it here.
			</p>
		);
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const scheduledAt = toIso(when);
		if (!scheduledAt) {
			setError("Pick a date and time.");
			return;
		}
		setSaving(true);
		try {
			await onAdd({ companyId, scheduledAt, round, companyType: companyType || null });
			onDone();
		} catch (e) {
			setError(errorMessage(e, "Could not save the interview"));
		} finally {
			setSaving(false);
		}
	}

	return (
		<form className="grid gap-3 rounded-[var(--radius-md)] border bg-card p-4 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
			<label className="grid gap-1.5 text-sm font-[550]">
				Application
				<select className={nativeSelectClass} value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
					{companies.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
				</select>
			</label>
			<label className="grid gap-1.5 text-sm font-[550]">
				Date and time
				<Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
			</label>
			<label className="grid gap-1.5 text-sm font-[550]">
				Round
				<select
					className={nativeSelectClass}
					value={round}
					onChange={(e) => setRound(e.target.value as InterviewRound)}
				>
					{INTERVIEW_ROUNDS.map((r) => (
						<option key={r} value={r}>
							{ROUND_LABELS[r]}
						</option>
					))}
				</select>
			</label>
			<label className="grid gap-1.5 text-sm font-[550]">
				Company type (optional)
				<select className={nativeSelectClass} value={companyType} onChange={(e) => setCompanyType(e.target.value)}>
					<option value="">Not sure</option>
					{COMPANY_TYPES.map((t) => (
						<option key={t} value={t}>
							{COMPANY_TYPE_LABELS[t]}
						</option>
					))}
				</select>
			</label>
			<div className="flex flex-wrap items-center gap-2 sm:col-span-2">
				<Button type="submit" disabled={saving}>
					{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					Save interview
				</Button>
				<Button type="button" variant="ghost" onClick={onDone}>
					Cancel
				</Button>
				{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
			</div>
		</form>
	);
}
