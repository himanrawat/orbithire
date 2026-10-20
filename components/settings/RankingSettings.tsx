"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Filter, Loader2, Mail, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Settings → Job ranking & digest. Standalone; mount it in the Settings page
 * (anchor id "ranking" is the target of the digest email's opt-out link).
 * Talks to GET/PUT /api/settings/ranking.
 */

interface RankingSettingsData {
	minSalary: number;
	minSalaryCurrency: string;
	homeCountry: string;
	knownLanguages: string[];
	needsVisaSponsorshipAbroad: boolean;
	excludedLocations: string[];
	excludedCompanies: string[];
	dailyLlmLimit: number;
	digestEnabled: boolean;
	digestHour: number;
	timezone: string;
}

interface Usage {
	day: string;
	llmCalls: number;
	embeddingCalls: number;
}

const toList = (s: string) =>
	s
		.split(",")
		.map((x) => x.trim())
		.filter(Boolean);

function Toggle({
	id,
	checked,
	onChange,
	label,
	description,
}: {
	id: string;
	checked: boolean;
	onChange: (v: boolean) => void;
	label: string;
	description?: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="space-y-1">
				<Label htmlFor={id}>{label}</Label>
				{description && <p className="text-xs text-muted-foreground">{description}</p>}
			</div>
			<button
				id={id}
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={cn(
					"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					checked ? "bg-primary" : "bg-muted"
				)}
			>
				<span
					className={cn(
						"inline-block h-5 w-5 rounded-full bg-background shadow transition-transform",
						checked ? "translate-x-5" : "translate-x-0.5"
					)}
				/>
			</button>
		</div>
	);
}

function formatHour(h: number) {
	const suffix = h < 12 ? "AM" : "PM";
	const hour = h % 12 === 0 ? 12 : h % 12;
	return `${hour}:00 ${suffix}`;
}

export function RankingSettings({ className }: { className?: string }) {
	const [data, setData] = useState<RankingSettingsData | null>(null);
	const [usage, setUsage] = useState<Usage | null>(null);
	const [lastDigestAt, setLastDigestAt] = useState<string | null>(null);
	// Free-text fields edited as comma-separated strings
	const [languages, setLanguages] = useState("");
	const [locations, setLocations] = useState("");
	const [companies, setCompanies] = useState("");
	const [minSalaryLpa, setMinSalaryLpa] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

	const apply = useCallback((s: RankingSettingsData) => {
		setData(s);
		setLanguages(s.knownLanguages.join(", "));
		setLocations(s.excludedLocations.join(", "));
		setCompanies(s.excludedCompanies.join(", "));
		setMinSalaryLpa(
			s.minSalaryCurrency === "INR" ? String(+(s.minSalary / 100000).toFixed(2)) : String(s.minSalary)
		);
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/settings/ranking");
				const json = await res.json();
				if (!res.ok) throw new Error(json.error || "Failed to load");
				if (cancelled) return;
				apply(json.settings);
				setUsage(json.usage);
				setLastDigestAt(json.lastDigestAt);
			} catch (e) {
				if (!cancelled) setMessage({ type: "error", text: (e as Error).message });
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [apply]);

	const update = <K extends keyof RankingSettingsData>(key: K, value: RankingSettingsData[K]) =>
		setData((d) => (d ? { ...d, [key]: value } : d));

	const save = async () => {
		if (!data) return;
		setSaving(true);
		setMessage(null);
		const salaryNumber = Number(minSalaryLpa);
		if (!Number.isFinite(salaryNumber) || salaryNumber < 0) {
			setMessage({ type: "error", text: "Enter a valid minimum salary" });
			setSaving(false);
			return;
		}
		try {
			const res = await fetch("/api/settings/ranking", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...data,
					minSalary: data.minSalaryCurrency === "INR" ? Math.round(salaryNumber * 100000) : salaryNumber,
					knownLanguages: toList(languages),
					excludedLocations: toList(locations),
					excludedCompanies: toList(companies),
				}),
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to save");
			apply(json.settings);
			setMessage({ type: "success", text: "Ranking settings saved" });
		} catch (e) {
			setMessage({ type: "error", text: (e as Error).message });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className={cn("flex items-center justify-center py-8", className)}>
				<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (!data) {
		return (
			<div className={cn("flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm", className)}>
				<AlertCircle className="h-4 w-4 text-red-500" />
				<span>{message?.text || "Could not load ranking settings"}</span>
			</div>
		);
	}

	const isInr = data.minSalaryCurrency === "INR";

	return (
		<div id="ranking" className={cn("grid gap-6", className)}>
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Filter className="h-5 w-5" />
						Deal-breakers
					</CardTitle>
					<CardDescription>
						Jobs that break one of these rules are hidden from your inbox (you can still see why) and never use AI
						credits.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="grid gap-4 sm:grid-cols-[1fr_120px]">
						<div className="space-y-2">
							<Label htmlFor="rk-min-salary">
								Minimum salary {isInr ? "(lakhs per annum)" : "(per year)"}
							</Label>
							<Input
								id="rk-min-salary"
								inputMode="decimal"
								value={minSalaryLpa}
								onChange={(e) => setMinSalaryLpa(e.target.value)}
							/>
							<p className="text-xs text-muted-foreground">
								Only applied when a posting discloses pay in the same currency. Monthly, weekly and hourly pay is
								converted to a yearly figure.
							</p>
						</div>
						<div className="space-y-2">
							<Label htmlFor="rk-currency">Currency</Label>
							<Input
								id="rk-currency"
								maxLength={3}
								value={data.minSalaryCurrency}
								onChange={(e) => update("minSalaryCurrency", e.target.value.toUpperCase())}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="rk-languages">Languages you speak</Label>
						<Input
							id="rk-languages"
							placeholder="English, Hindi"
							value={languages}
							onChange={(e) => setLanguages(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Jobs that require another language (e.g. &quot;fluent German required&quot;) are hidden. Comma-separated.
						</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="rk-country">Home country</Label>
							<Input
								id="rk-country"
								value={data.homeCountry}
								onChange={(e) => update("homeCountry", e.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="rk-locations">Excluded locations</Label>
							<Input
								id="rk-locations"
								placeholder="e.g. Mumbai, Chennai"
								value={locations}
								onChange={(e) => setLocations(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-2">
						<Label htmlFor="rk-companies">Excluded companies</Label>
						<Input
							id="rk-companies"
							placeholder="Comma-separated company names"
							value={companies}
							onChange={(e) => setCompanies(e.target.value)}
						/>
					</div>

					<Toggle
						id="rk-visa"
						checked={data.needsVisaSponsorshipAbroad}
						onChange={(v) => update("needsVisaSponsorshipAbroad", v)}
						label="I need visa sponsorship to work abroad"
						description="Hide onsite jobs outside your home country that say they can't sponsor a visa, and remote jobs limited to another country."
					/>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Sparkles className="h-5 w-5" />
						AI scoring
					</CardTitle>
					<CardDescription>
						Every new job gets a free similarity match. The best matches each day also get a detailed AI score with
						reasons.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="space-y-2">
						<Label htmlFor="rk-limit">AI-scored jobs per day</Label>
						<Input
							id="rk-limit"
							type="number"
							min={0}
							max={200}
							className="max-w-[140px]"
							value={data.dailyLlmLimit}
							onChange={(e) => update("dailyLlmLimit", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
						/>
						<p className="text-xs text-muted-foreground">
							Uses your own API key when you have one. Without one, OrbitHire&apos;s key scores up to 15 jobs a day while
							you still have free generations. 0 turns AI scoring off.
						</p>
					</div>
					{usage && (
						<p className="text-sm text-muted-foreground">
							{usage.llmCalls} AI score{usage.llmCalls === 1 ? "" : "s"} used on {usage.day}.
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Mail className="h-5 w-5" />
						Morning digest
					</CardTitle>
					<CardDescription>An email with your top 5 new matches. Skipped on days with no new matches.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Toggle
						id="rk-digest"
						checked={data.digestEnabled}
						onChange={(v) => update("digestEnabled", v)}
						label="Send me the morning digest"
					/>
					<div className={cn("grid gap-4 sm:grid-cols-2", !data.digestEnabled && "opacity-50")}>
						<div className="space-y-2">
							<Label htmlFor="rk-hour">Send at</Label>
							<select
								id="rk-hour"
								disabled={!data.digestEnabled}
								value={data.digestHour}
								onChange={(e) => update("digestHour", Number(e.target.value))}
								className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								{Array.from({ length: 24 }, (_, h) => (
									<option key={h} value={h}>
										{formatHour(h)}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="rk-tz">Time zone</Label>
							<Input
								id="rk-tz"
								disabled={!data.digestEnabled}
								value={data.timezone}
								onChange={(e) => update("timezone", e.target.value)}
								placeholder="Asia/Kolkata"
							/>
						</div>
					</div>
					{lastDigestAt && (
						<p className="text-xs text-muted-foreground">
							Last digest sent {new Date(lastDigestAt).toLocaleString()}.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="flex items-center gap-3">
				<Button onClick={save} disabled={saving}>
					{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
					Save ranking settings
				</Button>
				{message && (
					<span
						className={cn(
							"flex items-center gap-1 text-sm",
							message.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
						)}
					>
						{message.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
						{message.text}
					</span>
				)}
			</div>
		</div>
	);
}

export default RankingSettings;
