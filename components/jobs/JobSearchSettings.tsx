"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Briefcase, Building2, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
	API_SOURCES,
	ATS_TOKEN_HINTS,
	ATS_TYPES,
	COUNTRIES,
	DEFAULT_COUNTRY,
	JOB_SITES,
	MAX_JOB_SEARCHES,
	countryByCode,
	defaultSitesFor,
	defaultSourcesFor,
	siteAvailable,
	sourceAvailable,
	type ApiSource,
	type AtsType,
	type JobSearch,
	type JobSite,
	type SourceGroup,
	type WatchedCompany,
} from "@/lib/jobs/types";
import { detectAts } from "@/lib/jobs/portals";
import { nativeSelectClass } from "@/components/app/blocks";

type SearchForm = {
	name: string;
	keywords: string;
	include_keywords: string;
	exclude_keywords: string;
	locations: string;
	country: string;
	sites: JobSite[];
	sources: ApiSource[];
	remote_ok: boolean;
	hours_old: number;
	results_wanted: number;
	enabled: boolean;
};

const EMPTY_SEARCH: SearchForm = {
	name: "Default",
	keywords: "",
	include_keywords: "",
	exclude_keywords: "",
	locations: "India",
	country: DEFAULT_COUNTRY,
	sites: defaultSitesFor(DEFAULT_COUNTRY),
	sources: defaultSourcesFor(DEFAULT_COUNTRY),
	remote_ok: true,
	hours_old: 24,
	results_wanted: 20,
	enabled: true,
};

const splitList = (s: string) =>
	s
		.split(/[\n,]/)
		.map((x) => x.trim())
		.filter(Boolean);

function toForm(s: JobSearch): SearchForm {
	return {
		name: s.name,
		keywords: s.keywords.join(", "),
		include_keywords: (s.include_keywords || []).join(", "),
		exclude_keywords: s.exclude_keywords.join(", "),
		locations: s.locations.join(", "),
		country: s.country || DEFAULT_COUNTRY,
		sites: s.sites,
		sources: s.sources || [],
		remote_ok: s.remote_ok,
		hours_old: s.hours_old,
		results_wanted: s.results_wanted,
		enabled: s.enabled,
	};
}

const SOURCE_GROUPS: SourceGroup[] = ["Global", "UK", "Europe", "Singapore", "USA", "Remote", "Scrapers"];

const countryName = (code: string) => countryByCode(code)?.name || code;

/** Switch the form to another country: reset boards/sources to that country's defaults. */
function withCountry(form: SearchForm, code: string): SearchForm {
	const prevName = countryName(form.country);
	const locs = splitList(form.locations);
	const locations =
		!locs.length || (locs.length === 1 && locs[0].toLowerCase() === prevName.toLowerCase())
			? countryName(code)
			: form.locations;
	return { ...form, country: code, locations, sites: defaultSitesFor(code), sources: defaultSourcesFor(code) };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	const json = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(json.error || json.message || `Request failed (${res.status})`);
	return json as T;
}

type PortalImportResult = {
	companiesAdded: number;
	companiesUpdated: number;
	companiesSkipped: string[];
	search: { created: boolean } | null;
	searchSkipped?: string | null;
};

function portalImportNotice(result: PortalImportResult) {
	const prefix =
		`Imported: ${result.companiesAdded} companies added, ${result.companiesUpdated} updated, ` +
		`${result.companiesSkipped.length} skipped (no supported ATS board)`;
	if (result.search) {
		return `${prefix}; default search ${result.search.created ? "created" : "updated"}.`;
	}
	return result.searchSkipped ? `${prefix}. ${result.searchSkipped}` : `${prefix}.`;
}

function sourceTitle(source: (typeof API_SOURCES)[number]) {
	if (source.blocked) return `${source.label} can't be read without a browser, so it is skipped`;
	if (source.scraper) return "Reads public listing pages (no API): opt-in, low volume, may stop working";
	if (source.env.length) return `Needs ${source.env.join(" + ")} on the server`;
	if (source.remoteOnly) return "Remote jobs only";
	return undefined;
}

export function JobSearchSettings() {
	const [searches, setSearches] = useState<JobSearch[]>([]);
	const [companies, setCompanies] = useState<WatchedCompany[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [editing, setEditing] = useState<string | null>(null);
	const [form, setForm] = useState<SearchForm>(EMPTY_SEARCH);
	const [saving, setSaving] = useState(false);

	const [company, setCompany] = useState({ company: "", ats: "greenhouse" as AtsType, board_token: "", careers_url: "" });
	const atLimit = searches.length >= MAX_JOB_SEARCHES;
	const [importing, setImporting] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	const load = useCallback(async () => {
		try {
			const [s, w] = await Promise.all([
				api<{ searches: JobSearch[] }>("/api/jobs/searches"),
				api<{ companies: WatchedCompany[] }>("/api/jobs/watchlist"),
			]);
			setSearches(s.searches);
			setCompanies(w.companies);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const run = async (fn: () => Promise<unknown>, ok?: string) => {
		setError(null);
		setNotice(null);
		try {
			await fn();
			if (ok) setNotice(ok);
			await load();
			return true;
		} catch (e) {
			setError(e instanceof Error ? e.message : "Request failed");
			return false;
		}
	};

	const saveSearch = async () => {
		setSaving(true);
		const body = {
			...form,
			sites: form.sites.filter((x) => siteAvailable(x, form.country)),
			sources: form.sources.filter((x) => sourceAvailable(x, form.country)),
			keywords: splitList(form.keywords),
			include_keywords: splitList(form.include_keywords),
			exclude_keywords: splitList(form.exclude_keywords),
			locations: splitList(form.locations),
		};
		const ok = await run(
			() =>
				editing === "new"
					? api("/api/jobs/searches", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(body),
					  })
					: api(`/api/jobs/searches/${editing}`, {
							method: "PATCH",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify(body),
					  }),
			"Search saved"
		);
		setSaving(false);
		if (ok) setEditing(null);
	};

	const patch = (url: string, body: unknown) =>
		api(url, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

	const importPortals = async (file: File) => {
		setImporting(true);
		const fd = new FormData();
		fd.append("file", file);
		await run(async () => {
			const result = await api<PortalImportResult>("/api/jobs/import-portals", {
				method: "POST",
				body: fd,
			});
			setNotice(portalImportNotice(result));
		});
		setImporting(false);
		if (fileRef.current) fileRef.current.value = "";
	};

	if (loading) {
		return (
			<div className="flex justify-center py-12">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="grid gap-6">
			{error && (
				<div className="rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
					{error}
				</div>
			)}
			{notice && (
				<div className="rounded-lg border border-[color-mix(in_srgb,var(--success)_40%,transparent)] bg-[var(--success-soft)] p-3 text-sm">{notice}</div>
			)}

			{/* Searches */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Briefcase className="h-5 w-5" />
						Job searches
						<span className="ml-auto text-sm font-normal text-muted-foreground">
							{searches.length} of {MAX_JOB_SEARCHES}
						</span>
					</CardTitle>
					<CardDescription>
						Fetched every morning at 07:00 IST from the selected job boards and APIs (up to{" "}
						{MAX_JOB_SEARCHES} searches). Results land in your{" "}
						<Link href="/jobs" className="underline">
							Job Inbox
						</Link>
						.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{searches.length === 0 && editing !== "new" && (
						<p className="text-sm text-muted-foreground">No searches yet.</p>
					)}
					{searches.map((s) =>
						editing === s.id ? null : (
							<div key={s.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
								<div className="min-w-0 text-sm">
									<p className="font-medium">
										{s.name} {!s.enabled && <span className="text-muted-foreground">(paused)</span>}
									</p>
									<p className="truncate text-muted-foreground">
										{s.keywords.join(", ")} · {countryName(s.country || DEFAULT_COUNTRY)} ·{" "}
										{s.locations.join(", ") || "any location"} ·{" "}
										{[...s.sites, ...(s.sources || [])].join(", ")}
									</p>
									<p className="text-xs text-muted-foreground">
										last {s.hours_old}h · {s.results_wanted} per query · remote {s.remote_ok ? "ok" : "excluded"}
										{s.exclude_keywords.length ? ` · ${s.exclude_keywords.length} excluded words` : ""}
									</p>
								</div>
								<div className="flex shrink-0 gap-1">
									<Button
										size="sm"
										variant="ghost"
									onClick={() => void run(() => patch(`/api/jobs/searches/${s.id}`, { enabled: !s.enabled }))}
									>
										{s.enabled ? "Pause" : "Enable"}
									</Button>
									<Button
										size="icon"
										variant="ghost"
										onClick={() => {
											setForm(toForm(s));
											setEditing(s.id);
										}}
									>
										<Pencil className="h-4 w-4" />
									</Button>
									<Button
										size="icon"
										variant="ghost"
										onClick={() => {
											if (confirm(`Delete search "${s.name}"?`))
											void run(() => api(`/api/jobs/searches/${s.id}`, { method: "DELETE" }), "Search deleted");
										}}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
						)
					)}

					{editing ? (
						<div className="space-y-3 rounded-lg border p-4">
							<div className="grid gap-3 sm:grid-cols-3">
								<div className="space-y-1">
									<Label>Name</Label>
									<Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
								</div>
								<div className="space-y-1">
									<Label htmlFor="job-search-country">Country</Label>
									<select
										id="job-search-country"
										className={nativeSelectClass}
										value={form.country}
										onChange={(e) => setForm(withCountry(form, e.target.value))}
									>
										{COUNTRIES.map((c) => (
											<option key={c.code} value={c.code}>
												{c.name}
											</option>
										))}
									</select>
								</div>
								<div className="space-y-1">
									<Label>Locations (comma separated)</Label>
									<Input
										value={form.locations}
										onChange={(e) => setForm({ ...form, locations: e.target.value })}
										placeholder={form.country === "IN" ? "Bangalore, Remote" : countryName(form.country)}
									/>
								</div>
							</div>
							<div className="space-y-1">
								<Label>Search keywords (each one is a separate query per site and location)</Label>
								<Input
									value={form.keywords}
									onChange={(e) => setForm({ ...form, keywords: e.target.value })}
									placeholder="Frontend Engineer, React Developer"
								/>
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1">
									<Label>Title must contain one of (optional)</Label>
									<Textarea
										rows={3}
										value={form.include_keywords}
										onChange={(e) => setForm({ ...form, include_keywords: e.target.value })}
										placeholder="Frontend, React, UI Engineer"
									/>
								</div>
								<div className="space-y-1">
									<Label>Exclude titles containing</Label>
									<Textarea
										rows={3}
										value={form.exclude_keywords}
										onChange={(e) => setForm({ ...form, exclude_keywords: e.target.value })}
										placeholder="Intern, Junior, Android"
									/>
								</div>
							</div>
							<div className="space-y-1">
								<Label>Job boards (scraped)</Label>
								<div className="flex flex-wrap gap-3 text-sm">
									{JOB_SITES.filter((site) => siteAvailable(site, form.country)).map((site) => (
										<label key={site} className="flex items-center gap-1.5">
											<input
												type="checkbox"
												checked={form.sites.includes(site)}
												onChange={(e) =>
													setForm({
														...form,
														sites: e.target.checked
															? [...form.sites, site]
															: form.sites.filter((x) => x !== site),
													})
												}
											/>
											{site}
										</label>
									))}
								</div>
							</div>
							<div className="space-y-2">
								<Label>Job APIs</Label>
								{SOURCE_GROUPS.map((group) => {
									const items = API_SOURCES.filter(
										(src) => src.group === group && sourceAvailable(src.id, form.country)
									);
									if (!items.length) return null;
									return (
										<div key={group} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
											<span className="w-20 shrink-0 text-xs font-medium uppercase text-muted-foreground">
												{group}
											</span>
											{items.map((src) => (
												<label
													key={src.id}
													className="flex items-center gap-1.5"
											title={sourceTitle(src)}
												>
													<input
														type="checkbox"
														checked={form.sources.includes(src.id)}
														disabled={Boolean(src.blocked) || (src.remoteOnly && !form.remote_ok)}
														onChange={(e) =>
															setForm({
																...form,
																sources: e.target.checked
																	? [...form.sources, src.id]
																	: form.sources.filter((x) => x !== src.id),
															})
														}
													/>
													{src.label}
													{src.env.length > 0 && (
														<span className="text-xs text-muted-foreground">(API key)</span>
													)}
													{src.scraper && (
														<span className="text-xs text-muted-foreground">
															{src.blocked ? `(${src.blocked})` : "(scraper, may break)"}
														</span>
													)}
												</label>
											))}
										</div>
									);
								})}
								<p className="text-xs text-muted-foreground">
									Sources marked “API key” only run when the server has that key configured. Remote boards
									list remote jobs open to candidates in {countryName(form.country)}. Scrapers are never
									selected by default: they read public listing pages at low volume and may break.
								</p>
							</div>
							<div className="grid gap-3 sm:grid-cols-4">
								<div className="space-y-1">
									<Label>Posted within (hours)</Label>
									<Input
										type="number"
										min={1}
										max={720}
										value={form.hours_old}
										onChange={(e) => setForm({ ...form, hours_old: Number(e.target.value) })}
									/>
								</div>
								<div className="space-y-1">
									<Label>Results per query</Label>
									<Input
										type="number"
										min={1}
										max={500}
										value={form.results_wanted}
										onChange={(e) => setForm({ ...form, results_wanted: Number(e.target.value) })}
									/>
								</div>
								<label className="flex items-center gap-2 pt-6 text-sm">
									<input
										type="checkbox"
										checked={form.remote_ok}
										onChange={(e) => setForm({ ...form, remote_ok: e.target.checked })}
									/>
								<span>Include remote jobs</span>
								</label>
								<label className="flex items-center gap-2 pt-6 text-sm">
									<input
										type="checkbox"
										checked={form.enabled}
										onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
									/>
								<span>Enabled</span>
								</label>
							</div>
							<div className="flex gap-2">
							<Button onClick={() => void saveSearch()} disabled={saving}>
									{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
									Save search
								</Button>
								<Button variant="ghost" onClick={() => setEditing(null)}>
									Cancel
								</Button>
							</div>
						</div>
					) : (
						<div className="flex flex-wrap items-center gap-3">
							<Button
								variant="outline"
								disabled={atLimit}
								onClick={() => {
									setForm(EMPTY_SEARCH);
									setEditing("new");
								}}
							>
								<Plus className="mr-2 h-4 w-4" />
								Add search
							</Button>
							<span className="text-sm text-muted-foreground">
								{searches.length} of {MAX_JOB_SEARCHES}
								{atLimit && " – limit reached; edit or delete a search to add another"}
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Watchlist */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Building2 className="h-5 w-5" />
						Watched companies
					</CardTitle>
					<CardDescription>
						Company career boards on Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee, Personio
						or Teamtailor, checked every morning. Paste a careers URL to fill in the ATS and token. Titles are
						filtered with the include / exclude words of your enabled searches.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{companies.length > 0 && (
						<div className="max-h-96 divide-y overflow-y-auto rounded-lg border">
							{companies.map((c) => (
								<div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
									<div className="min-w-0">
										<span className="font-medium">{c.company}</span>{" "}
										<span className="text-muted-foreground">
											{c.ats}/{c.board_token}
										</span>
										{c.careers_url && (
											<a
												href={c.careers_url}
												target="_blank"
												rel="noopener noreferrer"
												className="ml-2 text-xs underline"
											>
												careers
											</a>
										)}
									</div>
									<div className="flex shrink-0 items-center gap-1">
										<label className="flex items-center gap-1 text-xs">
											<input
												type="checkbox"
												checked={c.enabled}
												onChange={() =>
												void run(() => patch(`/api/jobs/watchlist/${c.id}`, { enabled: !c.enabled }))
												}
											/>
									<span>enabled</span>
										</label>
										<Button
											size="icon"
											variant="ghost"
										onClick={() => void run(() => api(`/api/jobs/watchlist/${c.id}`, { method: "DELETE" }))}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
					<div className="grid gap-2 sm:grid-cols-5">
						<Input
							placeholder="Company"
							value={company.company}
							onChange={(e) => setCompany({ ...company, company: e.target.value })}
						/>
						<select
							className={nativeSelectClass}
							value={company.ats}
							onChange={(e) => setCompany({ ...company, ats: e.target.value as AtsType })}
						>
							{ATS_TYPES.map((a) => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
						<Input
							placeholder={ATS_TOKEN_HINTS[company.ats]}
							value={company.board_token}
							onChange={(e) => setCompany({ ...company, board_token: e.target.value })}
						/>
						<Input
							placeholder="Careers URL (optional)"
							value={company.careers_url}
							onChange={(e) => {
								const careers_url = e.target.value;
								const d = detectAts(careers_url);
								setCompany(
									d.ats && d.token
										? { ...company, careers_url, ats: d.ats, board_token: d.token }
										: { ...company, careers_url }
								);
							}}
						/>
						<Button
							onClick={async () => {
								const ok = await run(
									() =>
										api("/api/jobs/watchlist", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify(company),
										}),
									"Company added"
								);
								if (ok) setCompany({ company: "", ats: company.ats, board_token: "", careers_url: "" });
							}}
						>
							<Plus className="mr-1 h-4 w-4" />
							Add
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Import */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Upload className="h-5 w-5" />
						Import from career-ops portals.yml
					</CardTitle>
					<CardDescription>
						Adds every tracked company with a supported ATS board to the watchlist and creates
						a default search from <code>title_filter</code> (positive / negative keywords). Safe to re-run.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<input
						ref={fileRef}
						type="file"
						accept=".yml,.yaml,text/yaml"
						className="hidden"
						onChange={(e) => {
							const f = e.target.files?.[0];
								if (f) void importPortals(f);
						}}
					/>
					<Button variant="outline" disabled={importing} onClick={() => fileRef.current?.click()}>
						{importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
						Choose portals.yml
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
