"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Building2,
	Calendar,
	Check,
	ChevronLeft,
	Copy,
	ExternalLink,
	Loader2,
	MapPin,
	Plus,
	Sparkles,
	Wallet,
	X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScoreExplanation } from "@/components/jobs/ScoreExplanation";
import { SourceBadge } from "@/components/jobs/SourceBadge";
import {
	CRITERION_LABELS,
	formatSalary,
	mcpPrompt,
	type JobDetail,
	type MatchStatus,
} from "@/lib/jobs/types";

export default function JobDetailPage({ params }: Readonly<{ params: { id: string } }>) {
	const router = useRouter();
	const [job, setJob] = useState<JobDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const load = useCallback(async () => {
		try {
			const res = await fetch(`/api/jobs/${params.id}`, { cache: "no-store" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load job");
			setJob(json.job);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load job");
		} finally {
			setLoading(false);
		}
	}, [params.id]);

	useEffect(() => {
		void load();
	}, [load]);

	const setStatus = async (status: MatchStatus) => {
		setBusy(true);
		try {
			const res = await fetch(`/api/jobs/${params.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status }),
			});
			if (!res.ok) throw new Error((await res.json()).error || "Update failed");
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Update failed");
		} finally {
			setBusy(false);
		}
	};

	const createApplication = async () => {
		setBusy(true);
		try {
			const res = await fetch(`/api/jobs/${params.id}/application`, { method: "POST" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to create application");
			router.push(`/companies/${json.company.id}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create application");
			setBusy(false);
		}
	};

	const copyPrompt = async () => {
		if (!job) return;
		try {
			await navigator.clipboard.writeText(mcpPrompt(job));
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setError("Could not copy to clipboard");
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!job) {
		return (
			<div className="px-6 py-8">
				<p className="text-muted-foreground">{error || "Job not found."}</p>
				<Button variant="ghost" asChild className="mt-4">
					<Link href="/jobs">
						<ChevronLeft className="mr-1 h-4 w-4" />
						Back to Job Inbox
					</Link>
				</Button>
			</div>
		);
	}

	const salary = formatSalary(job);
	const reasons = job.llm_reasons;
	const criteria = reasons?.reasons ? Object.entries(reasons.reasons) : [];

	return (
		<div className="min-h-screen">
			<div className="relative mx-auto max-w-5xl px-4 py-8 md:px-8">
				<Link
					href="/jobs"
					className="-ml-1 mb-4 inline-flex min-h-9 items-center gap-1 rounded-[var(--radius-sm)] px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<ChevronLeft className="h-4 w-4" />
					Back to Job Inbox
				</Link>

				<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="font-display text-[26px] font-[680] leading-8 tracking-[-0.02em] md:text-[30px] md:leading-9">{job.title}</h1>
							<Badge variant="outline">{job.status}</Badge>
							{!job.is_active && <Badge variant="warning">no longer listed</Badge>}
						</div>
						<div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
							<span className="flex items-center gap-1">
								<Building2 className="h-4 w-4" />
								{job.company}
							</span>
							{(job.location || job.is_remote) && (
								<span className="flex items-center gap-1">
									<MapPin className="h-4 w-4" />
									{job.location || "Remote"}
									{job.is_remote && job.location && !/remote/i.test(job.location) ? " · Remote" : ""}
								</span>
							)}
							{salary && (
								<span className="flex items-center gap-1">
									<Wallet className="h-4 w-4" />
									{salary}
								</span>
							)}
							<span className="flex items-center gap-1">
								<Calendar className="h-4 w-4" />
								{job.posted_at
									? `posted ${new Date(job.posted_at).toLocaleDateString()}`
									: `first seen ${new Date(job.first_seen_at).toLocaleDateString()}`}
							</span>
							<SourceBadge source={job.source} url={job.url} />
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{job.status !== "shortlisted" && job.status !== "applied" && (
							<Button variant="outline" disabled={busy} onClick={() => setStatus("shortlisted")}>
								<Check className="mr-1 h-4 w-4" />
								Shortlist
							</Button>
						)}
						{job.status !== "skipped" && job.status !== "applied" && (
							<Button variant="ghost" disabled={busy} onClick={() => setStatus("skipped")}>
								<X className="mr-1 h-4 w-4" />
								Skip
							</Button>
						)}
						{job.url && (
							<Button variant="ghost" asChild>
								<a href={job.url} target="_blank" rel="noopener noreferrer">
									<ExternalLink className="mr-1 h-4 w-4" />
									Open posting
								</a>
							</Button>
						)}
						{job.company_id ? (
							<Button variant="secondary" asChild>
								<Link href={`/companies/${job.company_id}`}>View application</Link>
							</Button>
						) : (
							<Button variant="cap" disabled={busy} onClick={createApplication}>
								<Plus className="mr-1 h-4 w-4" />
								Create application
							</Button>
						)}
					</div>
				</div>

				{error && (
					<div className="mb-4 rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
						{error}
					</div>
				)}

				<div className="grid gap-6 lg:grid-cols-3">
					<Card className="lg:col-span-2">
						<CardHeader>
							<CardTitle className="text-lg">Job description</CardTitle>
						</CardHeader>
						<CardContent>
							{job.description ? (
								<div className="whitespace-pre-wrap text-sm leading-relaxed">{job.description}</div>
							) : (
								<p className="text-sm text-muted-foreground">
									The source did not include a description.{" "}
									{job.url && (
										<a href={job.url} target="_blank" rel="noopener noreferrer" className="underline">
											Open the posting
										</a>
									)}
								</p>
							)}
						</CardContent>
					</Card>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Score</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3 text-sm">
								<div className="flex items-baseline justify-between">
									<span className="text-muted-foreground">AI score</span>
									<span className="font-mono text-3xl font-semibold tabular-nums">{job.llm_score ?? "–"}</span>
								</div>
								<div className="flex items-baseline justify-between">
									<span className="text-muted-foreground">Profile similarity</span>
									<span>{job.similarity != null ? `${Math.round(job.similarity * 100)}%` : "–"}</span>
								</div>
								{reasons?.summary && <p>{reasons.summary}</p>}
								{criteria.length > 0 && (
									<ul className="space-y-2">
										{criteria.map(([k, v]) => (
											<li key={k}>
												<div className="flex justify-between font-medium">
													<span>{CRITERION_LABELS[k] || k}</span>
													<span>{v?.score ?? "–"}</span>
												</div>
												{v?.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
											</li>
										))}
									</ul>
								)}
								<ScoreExplanation explanation={reasons?.explanation} />
								{(reasons?.red_flags || []).length > 0 && (
									<div>
										<p className="font-medium">Red flags</p>
										<ul className="list-disc pl-5 text-xs text-muted-foreground">
											{reasons!.red_flags!.map((flag) => (
												<li key={flag}>{flag}</li>
											))}
										</ul>
									</div>
								)}
								{job.prefilter_pass === false && (
									<div>
										<p className="font-medium text-destructive">Hidden by your filters</p>
										<ul className="list-disc pl-5 text-xs text-muted-foreground">
											{(job.deal_breakers || []).map((d, i) => (
												<li key={`${d.code}-${i}`}>{d.reason || d.code}</li>
											))}
										</ul>
									</div>
								)}
								{reasons?.error && (
									<p className="text-xs text-muted-foreground">Scoring failed: {reasons.error}</p>
								)}
								{job.llm_score == null && job.similarity == null && !reasons && (
									<p className="text-xs text-muted-foreground">Not ranked yet.</p>
								)}
								{reasons?.model && (
									<p className="text-xs text-muted-foreground">
										{reasons.provider}/{reasons.model}
									</p>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-lg">Documents</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								<Button className="w-full" asChild>
									<Link href={`/generate?job=${job.id}`}>
										<Sparkles className="mr-2 h-4 w-4" />
										Generate documents
									</Link>
								</Button>
								<Button variant="outline" className={cn("w-full")} onClick={copyPrompt}>
									<Copy className="mr-2 h-4 w-4" />
									{copied ? "Copied" : "Copy MCP prompt"}
								</Button>
								<p className="text-xs text-muted-foreground">
									Generate documents opens the resume generator with this job filled in. The MCP
									prompt is for Claude / ChatGPT once the NextMilestone MCP server is connected.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
