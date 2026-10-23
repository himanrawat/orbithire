import { describe, expect, it } from "vitest";
import {
	HANDLE_PATTERN,
	formatMilestoneDate,
	groupByYear,
	handleProblem,
	isDateOnly,
	isValidHandle,
	parsePublicLearning,
	parsePublicProfile,
	publicOnly,
	publicProfileRobots,
	suggestHandle,
} from "@/lib/milestones/model";
import {
	milestoneCreateSchema,
	milestoneUpdateSchema,
	publicSettingsSchema,
	suggestionActionSchema,
} from "@/lib/milestones/schema";
import { settingsProblem, toPublicSettings } from "@/lib/milestones/server";
import { EXPORT_TABLES } from "@/lib/account/export";

describe("handles", () => {
	it("accepts lowercase slugs of 3-30 characters", () => {
		expect(isValidHandle("jane-doe")).toBe(true);
		expect(isValidHandle("abc")).toBe(true);
		expect(isValidHandle("a".repeat(30))).toBe(true);
		expect(isValidHandle("  Jane-Doe ")).toBe(true);
	});

	it("rejects bad shapes, double hyphens and reserved words", () => {
		expect(isValidHandle("ab")).toBe(false);
		expect(isValidHandle("a".repeat(31))).toBe(false);
		expect(isValidHandle("-jane")).toBe(false);
		expect(isValidHandle("jane-")).toBe(false);
		expect(isValidHandle("jane doe")).toBe(false);
		expect(isValidHandle("jane_doe")).toBe(false);
		expect(handleProblem("jane--doe")).toMatch(/one hyphen/);
		expect(handleProblem("admin")).toMatch(/reserved/);
	});

	it("checks long non-matching input quickly (linear regex)", () => {
		const start = performance.now();
		expect(HANDLE_PATTERN.test(`${"a-".repeat(50_000)}!`)).toBe(false);
		expect(performance.now() - start).toBeLessThan(100);
	});

	it("suggests a handle from a name", () => {
		expect(suggestHandle("Jane Q. Doe")).toBe("jane-q-doe");
		expect(suggestHandle("")).toBe("");
		expect(suggestHandle("Al")).toBe("");
	});
});

describe("dates and grouping", () => {
	it("validates date-only strings", () => {
		expect(isDateOnly("2026-03-14")).toBe(true);
		expect(isDateOnly("2026-02-30")).toBe(false);
		expect(isDateOnly("03/14/2026")).toBe(false);
	});

	it("formats in US style without shifting the day", () => {
		expect(formatMilestoneDate("2026-01-01")).toBe("Jan 2026");
	});

	it("groups newest first by year", () => {
		const groups = groupByYear([
			{ id: "a", happened_on: "2025-05-01" },
			{ id: "b", happened_on: "2026-01-01" },
			{ id: "c", happened_on: "2026-06-01" },
		]);
		expect(groups.map(([year]) => year)).toEqual(["2026", "2025"]);
		expect(groups[0][1].map((m) => m.id)).toEqual(["c", "b"]);
	});

	it("keeps only public items for the preview", () => {
		const items = [
			{ id: "a", visibility: "public" as const },
			{ id: "b", visibility: "private" as const },
		];
		expect(publicOnly(items).map((m) => m.id)).toEqual(["a"]);
	});
});

describe("public profile", () => {
	const raw = {
		handle: "jane-doe",
		full_name: "Jane Doe",
		headline: "Product designer",
		search_indexing: false,
		email: "jane@example.com",
		open_to_roles: true,
		milestones: [
			{ id: "m1", kind: "job", title: "Joined Acme", description: null, happened_on: "2026-01-01", visibility: "private" },
			{ id: "m2", kind: "weird", title: "Spoke", happened_on: "2025-01-01" },
			{ nope: true },
		],
		learning: [
			{ id: "l1", title: null, note: "Read SICP", url: null, tags: ["cs", 3], created_at: "2026-02-01T00:00:00Z" },
			{ id: "l2", title: "Bad link", url: "javascript:alert(1)", tags: [], created_at: "2026-02-01T00:00:00Z" },
		],
	};

	it("never passes through email, open_to_roles or extra fields", () => {
		const profile = parsePublicProfile(raw);
		expect(profile).not.toBeNull();
		const text = JSON.stringify(profile);
		expect(text).not.toContain("open_to_roles");
		expect(text).not.toContain("jane@example.com");
		expect(text).not.toContain("visibility");
		expect(Object.keys(profile!).sort()).toEqual(
			["full_name", "handle", "headline", "learning", "milestones", "search_indexing"].sort()
		);
	});

	it("drops malformed milestones and unknown kinds become other", () => {
		const profile = parsePublicProfile(raw)!;
		expect(profile.milestones.map((m) => m.id)).toEqual(["m1", "m2"]);
		expect(profile.milestones[1].kind).toBe("other");
	});

	it("narrows learning entries and drops unsafe URLs", () => {
		const learning = parsePublicLearning(raw.learning);
		expect(learning[0]).toMatchObject({ title: "Read SICP", note: null, tags: ["cs"] });
		expect(learning[1].url).toBeNull();
	});

	it("returns null for a disabled or missing profile", () => {
		expect(parsePublicProfile(null)).toBeNull();
		expect(parsePublicProfile({})).toBeNull();
	});

	it("is noindex unless the owner opted in", () => {
		expect(publicProfileRobots({ search_indexing: false })).toEqual({ index: false, follow: false });
		expect(publicProfileRobots(null)).toEqual({ index: false, follow: false });
		expect(publicProfileRobots({ search_indexing: true })).toEqual({ index: true, follow: true });
	});
});

describe("API schemas", () => {
	it("creates private manual milestones by default", () => {
		const parsed = milestoneCreateSchema.parse({ title: " Promoted ", happened_on: "2026-03-01" });
		expect(parsed).toMatchObject({ title: "Promoted", kind: "other", visibility: "private" });
	});

	it("rejects unknown fields such as source or user_id", () => {
		expect(milestoneCreateSchema.safeParse({ title: "x", happened_on: "2026-03-01", user_id: "u" }).success).toBe(false);
		expect(milestoneUpdateSchema.safeParse({ source: "event" }).success).toBe(false);
		expect(milestoneUpdateSchema.safeParse({}).success).toBe(false);
	});

	it("turns an empty description into null", () => {
		expect(milestoneUpdateSchema.parse({ description: "  " })).toEqual({ description: null });
	});

	it("validates suggestion actions", () => {
		expect(suggestionActionSchema.safeParse({ action: "accept" }).success).toBe(true);
		expect(suggestionActionSchema.safeParse({ action: "delete" }).success).toBe(false);
	});

	it("normalizes and validates handles in settings", () => {
		expect(publicSettingsSchema.parse({ public_handle: " Jane-Doe " })).toEqual({ public_handle: "jane-doe" });
		expect(publicSettingsSchema.safeParse({ public_handle: "admin" }).success).toBe(false);
		expect(publicSettingsSchema.safeParse({ email: "x" }).success).toBe(false);
	});
});

describe("public settings", () => {
	it("defaults everything off", () => {
		expect(toPublicSettings(null)).toEqual({
			public_handle: null,
			public_profile_enabled: false,
			search_indexing: false,
			open_to_roles: false,
		});
	});

	it("needs a handle before the profile can go public", () => {
		const off = toPublicSettings(null);
		expect(settingsProblem(off, { public_profile_enabled: true })).toMatch(/handle/);
		expect(settingsProblem(off, { public_profile_enabled: true, public_handle: "jane-doe" })).toBeNull();
		const on = { ...off, public_handle: "jane-doe", public_profile_enabled: true };
		expect(settingsProblem(on, { public_handle: null })).toMatch(/handle/);
	});

	it("includes milestones in the self-serve export", () => {
		const tables = EXPORT_TABLES.map((t) => t.table);
		expect(tables).toContain("milestones");
		expect(tables).toContain("milestone_suggestions");
	});
});
