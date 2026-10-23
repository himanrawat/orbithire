"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/jobs/SourceBadge";
import { FetchNowButton } from "@/components/jobs/FetchNowButton";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState, nativeSelectClass, tabClass, tabCountClass, tabListClass } from "@/components/app/blocks";
import {
	Briefcase,
	Building2,
	Calendar,
	Check,
	EyeOff,
	ExternalLink,
	Loader2,
	MapPin,
	Plus,
	Settings2,
	Wallet,
	X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
	MATCH_STATUSES,
	formatSalary,
	type InboxRow,
	type MatchStatus,
} from "@/lib/jobs/types";

type InboxResponse = {
	jobs: InboxRow[];
	hiddenCount: number;
	counts: Record<string, number>;
	sources: string[];
	pageSize: number;
};

const STATUS_LABELS: Record<MatchStatus, string> = {
	new: "New",
	shortlisted: "Shortlisted",
	skipped: "Skipped",
	applied: "Applied",
	expired: "Expired",
};

function timeAgo(iso: string | null): string | null {
	if (!iso) return null;
	const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
	if (days <= 0) return "today";
	if (days === 1) return "yesterday";
	if (days < 30) return `${days} days ago`;
	return new Date(iso).toLocaleDateString();
}

function scoreClass(score: number) {
	if (score >= 75) return "bg-[var(--success-soft)] text-[var(--success)]";
	if (score >= 50) return "bg-[var(--cap-soft)] text-[var(--cap-ink)]";
	return "bg-secondary text-muted-foreground";
}

function emptyJobsTitle(showHidden: boolean, status: MatchStatus) {
	if (showHidden) return "No hidden jobs";
	if (status === "new") return "No new jobs yet";
	return `No ${STATUS_LABELS[status].toLowerCase()} jobs`;
}

type JobFilters = {
	status: MatchStatus;
	source: string;
	remote: boolean;
	minSalary: string;
	minScore: string;
	showHidden: boolean;
};

function buildJobsQuery(filters: JobFilters) {
	const query = new URLSearchParams({ status: filters.status });
	if (filters.source) query.set("source", filters.source);
	if (filters.remote) query.set("remote", "1");
	if (Number(filters.minSalary) > 0) query.set("min_salary", filters.minSalary);
	if (Number(filters.minScore) > 0) query.set("min_score", filters.minScore);
	if (filters.showHidden) query.set("hidden", "1");
	return query;
}

export default function JobInboxPage() {
	// The daily fetch runs at 07:00 IST (01:30 UTC); show it in the viewer's own time zone.
	const [fetchTime, setFetchTime] = useState("");
	useEffect(() => {
		setFetchTime(
			new Date(Date.UTC(2000, 0, 1, 1, 30)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" })
		);
	}, []);

	const router = useRouter();
	const [status, setStatus] = useState<MatchStatus>("new");
	const [source, setSource] = useState("");
	const [remote, setRemote] = useState(false);
	const [minSalary, setMinSalary] = useState("");
	const [minScore, setMinScore] = useState("");
	const [showHidden, setShowHidden] = useState(false);
	const [data, setData] = useState<InboxResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		const q = buildJobsQuery({ status, source, remote, minSalary, minScore, showHidden });
		try {
			const res = await fetch(`/api/jobs?${q}`, { cache: "no-store" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load jobs");
			setData(json);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load jobs");
		} finally {
			setLoading(false);
		}
	}, [status, source, remote, minSalary, minScore, showHidden]);

	useEffect(() => {
		const t = setTimeout(load, 200);
		return () => clearTimeout(t);
	}, [load]);

	const setMatchStatus = async (id: string, next: MatchStatus) => {
		setBusyId(id);
		try {
			const res = await fetch(`/api/jobs/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: next }),
			});
			if (!res.ok) throw new Error((await res.json()).error || "Update failed");
			await load();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Update failed");
		} finally {
			setBusyId(null);
		}
	};

	const createApplication = async (id: string) => {
		setBusyId(id);
		try {
			const res = await fetch(`/api/jobs/${id}/application`, { method: "POST" });
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to create application");
			router.push(`/companies/${json.company.id}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to create application");
			setBusyId(null);
		}
	};

	const jobs = data?.jobs || [];
	const initialLoading = loading && !data;
	const noJobs = !initialLoading && jobs.length === 0;
	const hasJobs = !initialLoading && jobs.length > 0;

	return (
		<div className="min-h-screen">
			<div className="relative mx-auto max-w-6xl px-4 py-8 md:px-8">
				<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
					<PageHeader
						icon={<Briefcase />}
						title="Job Inbox"
						description={
							<>
								New jobs are fetched every morning{fetchTime ? ` at ${fetchTime}` : ""}.{" "}
								<Link href="/settings?tab=job-search" className="inline-flex items-center gap-1 font-medium text-[var(--info)] underline underline-offset-2">
									<Settings2 className="h-3.5 w-3.5" />
									Job search settings
								</Link>
							</>
						}
						actions={<FetchNowButton onDone={load} />}
						className="mb-6"
					/>
				</motion.div>

				{/* Status tabs */}
				<div role="tablist" aria-label="Job status" className={cn(tabListClass, "mb-4")}>
					{MATCH_STATUSES.map((s) => (
						<button
							key={s}
							role="tab"
							aria-selected={status === s}
							onClick={() => {
								setStatus(s);
								setShowHidden(false);
							}}
							className={tabClass(status === s)}
						>
							{STATUS_LABELS[s]}
							<span className={tabCountClass(status === s)}>{data?.counts?.[s] ?? 0}</span>
						</button>
					))}
				</div>

				{/* Filters */}
				<div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
					<select
						value={source}
						onChange={(e) => setSource(e.target.value)}
						className={nativeSelectClass}
						aria-label="Source"
					>
						<option value="">All sources</option>
						{(data?.sources || []).map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
					<label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] border border-input bg-card px-3.5 text-[15px] hover:border-foreground/50">
						<input type="checkbox" className="size-4 accent-[var(--ink)]" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
						<span>Remote only</span>
					</label>
					<Input
						type="number"
						min={0}
						placeholder="Min salary / yr (e.g. 120000)"
						value={minSalary}
						onChange={(e) => setMinSalary(e.target.value)}
					/>
					<Input
						type="number"
						min={0}
						max={100}
						placeholder="Min score (0–100)"
						value={minScore}
						onChange={(e) => setMinScore(e.target.value)}
					/>
					<Button
						variant={showHidden ? "secondary" : "outline"}
						onClick={() => setShowHidden(!showHidden)}
						disabled={!showHidden && !data?.hiddenCount}
					>
						<EyeOff className="h-4 w-4" />
						{showHidden ? "Back to visible jobs" : `Show hidden (${data?.hiddenCount ?? 0})`}
					</Button>
				</div>

				{error && (
					<div role="alert" className="mb-4 rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
						{error}
					</div>
				)}

					{initialLoading && (
					<div className="flex justify-center py-20">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
					)}
					{noJobs && (
					<Card>
						<EmptyState
								title={emptyJobsTitle(showHidden, status)}
							description={
								!showHidden && status === "new" ? "Set up a job search or a company watchlist, then press Fetch now." : undefined
							}
						/>
					</Card>
					)}
					{hasJobs && (
					<div className={cn("grid grid-cols-1 gap-3", loading && "opacity-60")}>
						{jobs.map((job) => {
							const salary = formatSalary(job);
							const reasons = job.llm_reasons;
							const topReasons = reasons?.reasons
								? Object.entries(reasons.reasons)
										.filter(([, v]) => v && v.note)
										.sort((a, b) => (b[1]?.score ?? 0) - (a[1]?.score ?? 0))
										.slice(0, 2)
								: [];
							const busy = busyId === job.id;
							return (
								<Card key={job.id} className={cn(!job.seen_at && "border-l-[3px] border-l-[var(--cap)]")}>
									<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												{job.llm_score != null && (
													<span
														className={cn(
															"rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums",
															scoreClass(job.llm_score)
														)}
														title="AI match score"
													>
														{job.llm_score}
													</span>
												)}
												{job.llm_score == null && job.similarity != null && (
													<span
														className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground"
														title="Profile similarity"
													>
														sim {Math.round(job.similarity * 100)}%
													</span>
												)}
												<Link
													href={`/jobs/${job.id}`}
													className="max-w-full truncate font-display text-[17px] font-[650] leading-6 tracking-[-0.01em] hover:underline"
												>
													{job.title}
												</Link>
												{!job.seen_at && <Badge variant="secondary">new</Badge>}
											</div>
											<div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
												<span className="flex items-center gap-1">
													<Building2 className="h-3.5 w-3.5" />
													{job.company}
												</span>
												{(job.location || job.is_remote) && (
													<span className="flex items-center gap-1">
														<MapPin className="h-3.5 w-3.5" />
														{job.location || "Remote"}
														{job.is_remote && job.location && !/remote/i.test(job.location)
															? " · Remote"
															: ""}
													</span>
												)}
												{salary && (
													<span className="flex items-center gap-1">
														<Wallet className="h-3.5 w-3.5" />
														{salary}
													</span>
												)}
												<span className="flex items-center gap-1">
													<Calendar className="h-3.5 w-3.5" />
													{timeAgo(job.posted_at) || `seen ${timeAgo(job.first_seen_at)}`}
												</span>
												<SourceBadge source={job.source} url={job.url} />
											</div>
											{reasons?.summary && (
												<p className="mt-2 text-sm">{reasons.summary}</p>
											)}
											{topReasons.length > 0 && (
												<ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
													{topReasons.map(([k, v]) => (
														<li key={k}>· {v?.note}</li>
													))}
												</ul>
											)}
											{job.prefilter_pass === false && (job.deal_breakers || []).length > 0 && (
												<div className="mt-2 flex flex-wrap gap-1">
													{(job.deal_breakers || []).map((d, i) => (
														<span
															key={`${d.code}-${i}`}
															className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
														>
															{d.reason || d.code}
														</span>
													))}
												</div>
											)}
										</div>
										<div className="flex shrink-0 flex-wrap gap-2">
											{job.status !== "shortlisted" && job.status !== "applied" && (
												<Button
													size="sm"
													variant="outline"
													disabled={busy}
													onClick={() => setMatchStatus(job.id, "shortlisted")}
												>
													<Check className="mr-1 h-4 w-4" />
													Shortlist
												</Button>
											)}
											{job.status !== "skipped" && job.status !== "applied" && (
												<Button
													size="sm"
													variant="ghost"
													disabled={busy}
													onClick={() => setMatchStatus(job.id, "skipped")}
												>
													<X className="mr-1 h-4 w-4" />
													Skip
												</Button>
											)}
											{job.url && (
												<Button size="sm" variant="ghost" asChild>
													<a href={job.url} target="_blank" rel="noopener noreferrer">
														<ExternalLink className="mr-1 h-4 w-4" />
														Open
													</a>
												</Button>
											)}
											{job.company_id ? (
												<Button size="sm" variant="secondary" asChild>
													<Link href={`/companies/${job.company_id}`}>Application</Link>
												</Button>
											) : (
												<Button size="sm" disabled={busy} onClick={() => createApplication(job.id)}>
													{busy ? (
														<Loader2 className="mr-1 h-4 w-4 animate-spin" />
													) : (
														<Plus className="mr-1 h-4 w-4" />
													)}
													Create application
												</Button>
											)}
										</div>
									</CardContent>
								</Card>
							);
						})}
						{data && jobs.length >= data.pageSize && (
							<p className="text-center text-xs text-muted-foreground">
								Showing the top {data.pageSize}. Narrow the filters to see others.
							</p>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
