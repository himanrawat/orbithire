// Client-side calls for milestones and public profile settings. Each returns data or an
// error message; none throws.

import type {
	Milestone,
	MilestoneSuggestion,
	PublicProfileSettings,
	SuggestionAction,
} from "@/lib/milestones/model";

type Body = Record<string, unknown>;

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function request<T>(url: string, init: RequestInit | undefined, pick: (body: Body) => T): Promise<Result<T>> {
	try {
		const res = await fetch(url, {
			...init,
			headers: init?.body ? { "Content-Type": "application/json" } : undefined,
		});
		const body = ((await res.json().catch(() => null)) ?? {}) as Body;
		if (!res.ok) {
			const message = typeof body.error === "string" ? body.error : "Something went wrong. Try again.";
			const issue = Array.isArray(body.issues) ? (body.issues[0] as { message?: unknown } | undefined)?.message : undefined;
			return { ok: false, error: typeof issue === "string" ? issue : message };
		}
		return { ok: true, data: pick(body) };
	} catch {
		return { ok: false, error: "You seem to be offline. Try again." };
	}
}

export type MilestoneInput = Pick<Milestone, "kind" | "title" | "description" | "happened_on" | "visibility">;

export function fetchMilestones() {
	return request<Milestone[]>("/api/milestones", undefined, (b) => (b.milestones ?? []) as Milestone[]);
}

export function createMilestoneRequest(input: MilestoneInput) {
	return request<Milestone>("/api/milestones", { method: "POST", body: JSON.stringify(input) }, (b) => b.milestone as Milestone);
}

export function updateMilestoneRequest(id: string, input: Partial<MilestoneInput>) {
	return request<Milestone>(
		`/api/milestones/${encodeURIComponent(id)}`,
		{ method: "PATCH", body: JSON.stringify(input) },
		(b) => b.milestone as Milestone
	);
}

export function deleteMilestoneRequest(id: string) {
	return request<true>(`/api/milestones/${encodeURIComponent(id)}`, { method: "DELETE" }, () => true);
}

export function fetchSuggestions() {
	return request<MilestoneSuggestion[]>("/api/milestones/suggestions", undefined, (b) => (b.suggestions ?? []) as MilestoneSuggestion[]);
}

export function actOnSuggestion(id: string, action: SuggestionAction) {
	return request<Milestone | null>(
		`/api/milestones/suggestions/${encodeURIComponent(id)}`,
		{ method: "POST", body: JSON.stringify({ action }) },
		(b) => (b.milestone ?? null) as Milestone | null
	);
}

export function fetchPublicSettings() {
	return request<PublicProfileSettings>("/api/profile/public-settings", undefined, (b) => b.settings as PublicProfileSettings);
}

export function savePublicSettingsRequest(update: Partial<PublicProfileSettings>) {
	return request<PublicProfileSettings>(
		"/api/profile/public-settings",
		{ method: "PATCH", body: JSON.stringify(update) },
		(b) => b.settings as PublicProfileSettings
	);
}
