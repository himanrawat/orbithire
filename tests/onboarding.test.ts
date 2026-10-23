import { describe, expect, it } from "vitest";
import {
	CAREER_STAGES,
	GOAL_SUGGESTIONS,
	goalOptionsFor,
	isCareerStage,
	needsOnboarding,
	normalizeList,
	toggleInList,
} from "@/lib/onboarding/stages";
import { LOCATION_OPTIONS, REMOTE_US, US_METROS, filterLocations, hasExactLocation } from "@/lib/onboarding/locations";
import { STAGE_DEFAULTS, orderByStage, stageDefaultsFor } from "@/lib/onboarding/stageDefaults";
import { buildOnboardingUpdate, onboardingSchema, toOnboardingProfile } from "@/lib/onboarding/schema";
import { buildResumeReviewRows, selectedFields, suggestedRole, type ReviewField } from "@/lib/onboarding/resumeReview";
import { formatSalary } from "@/lib/jobs/types";

describe("stages", () => {
	it("recognizes the four stages", () => {
		expect(CAREER_STAGES).toEqual(["student", "early", "experienced", "leader"]);
		expect(isCareerStage("leader")).toBe(true);
		expect(isCareerStage("vp")).toBe(false);
		expect(isCareerStage(3)).toBe(false);
	});

	it("normalizes lists: trims, de-duplicates case-insensitively and caps", () => {
		expect(normalizeList([" A ", "a", "", "b", "c"], 2, 10)).toEqual(["A", "b"]);
		expect(normalizeList(["abcdef"], 5, 3)).toEqual(["abc"]);
	});

	it("offers stage suggestions plus custom goals", () => {
		const options = goalOptionsFor("student", ["Custom goal", "Land an internship"]);
		expect(options.slice(0, GOAL_SUGGESTIONS.student.length)).toEqual([...GOAL_SUGGESTIONS.student]);
		expect(options).toContain("Custom goal");
		expect(options.filter((o) => o === "Land an internship")).toHaveLength(1);
	});

	it("toggles within a maximum", () => {
		expect(toggleInList(["a"], "a", 2)).toEqual([]);
		expect(toggleInList(["a"], "b", 2)).toEqual(["a", "b"]);
		expect(toggleInList(["a", "b"], "c", 2)).toEqual(["a", "b"]);
	});

	it("redirects only people who never finished and weren't shown setup", () => {
		expect(needsOnboarding(null, false)).toBe(true);
		expect(needsOnboarding(null, true)).toBe(false);
		expect(needsOnboarding("2026-10-24T00:00:00Z", false)).toBe(false);
	});
});

describe("locations", () => {
	it("puts Remote (US) first and has about 50 unique metros", () => {
		expect(LOCATION_OPTIONS[0]).toBe(REMOTE_US);
		expect(US_METROS.length).toBeGreaterThanOrEqual(45);
		expect(new Set(US_METROS).size).toBe(US_METROS.length);
	});

	it("filters ignoring case and punctuation", () => {
		expect(filterLocations("")).toHaveLength(LOCATION_OPTIONS.length);
		expect(filterLocations("austin")).toEqual(["Austin, TX"]);
		expect(filterLocations("dallas fort")).toEqual(["Dallas–Fort Worth, TX"]);
		expect(filterLocations("remote")).toEqual([REMOTE_US]);
		expect(filterLocations("zzz")).toEqual([]);
	});

	it("detects exact matches", () => {
		expect(hasExactLocation("austin tx")).toBe(true);
		expect(hasExactLocation("Austin")).toBe(false);
		expect(hasExactLocation("")).toBe(false);
	});

	it("stays fast on long non-matching input", () => {
		const start = Date.now();
		filterLocations(`${"-".repeat(50_000)}!`);
		expect(Date.now() - start).toBeLessThan(500);
	});
});

describe("stage defaults", () => {
	it("has weights that sum to 1 for every stage", () => {
		for (const stage of CAREER_STAGES) {
			const total = Object.values(STAGE_DEFAULTS[stage].todayWeights).reduce((sum, w) => sum + w, 0);
			expect(total).toBeCloseTo(1, 5);
		}
	});

	it("falls back to early career", () => {
		expect(stageDefaultsFor(null)).toBe(STAGE_DEFAULTS.early);
	});

	it("orders nav items by stage, keeping unknown items stable at the end", () => {
		const items = [{ href: "/dashboard" }, { href: "/jobs" }, { href: "/x" }, { href: "/resumes" }, { href: "/y" }];
		expect(orderByStage(items, "student").map((i) => i.href)).toEqual(["/dashboard", "/resumes", "/jobs", "/x", "/y"]);
	});
});

describe("onboarding schema", () => {
	it("is strict and enforces limits", () => {
		expect(onboardingSchema.safeParse({ extra: 1 }).success).toBe(false);
		expect(onboardingSchema.safeParse({ career_stage: "vp" }).success).toBe(false);
		expect(onboardingSchema.safeParse({ goals: Array(13).fill("g") }).success).toBe(false);
		expect(onboardingSchema.safeParse({ target_locations: Array(11).fill("x") }).success).toBe(false);
		expect(onboardingSchema.safeParse({ weekly_focus_hours: 81 }).success).toBe(false);
		expect(onboardingSchema.safeParse({ target_role: "x".repeat(121) }).success).toBe(false);
		expect(onboardingSchema.safeParse({ career_stage: "student", goals: ["Learn"], complete: true }).success).toBe(true);
	});

	it("accepts IANA time zones in canonical form and rejects the rest", () => {
		const parse = (timezone: string) => onboardingSchema.safeParse({ timezone });
		const ok = parse("america/chicago");
		expect(ok.success && ok.data.timezone).toBe("America/Chicago");
		expect(parse("UTC").success).toBe(true);
		for (const bad of ["", "Mars/Olympus", "+05:30", "x".repeat(65)]) {
			expect(parse(bad).success).toBe(false);
		}
		expect(buildOnboardingUpdate({ timezone: "America/Denver" }, new Date())).toEqual({ timezone: "America/Denver" });
	});

	it("builds an update with only the sent fields", () => {
		const now = new Date("2026-10-24T12:00:00Z");
		expect(buildOnboardingUpdate({}, now)).toEqual({});
		expect(buildOnboardingUpdate({ complete: true }, now)).toEqual({ onboarded_at: now.toISOString() });
		expect(
			buildOnboardingUpdate({ goals: ["A", "a", "B"], target_role: "", target_locations: ["Austin, TX"] }, now)
		).toEqual({ goals: ["A", "B"], target_role: null, target_locations: ["Austin, TX"] });
	});

	it("narrows profile rows", () => {
		expect(toOnboardingProfile(null)).toEqual({
			career_stage: null,
			goals: [],
			target_role: null,
			target_locations: [],
			weekly_focus_hours: null,
			onboarded_at: null,
			timezone: null,
		});
		expect(toOnboardingProfile({ career_stage: "bogus", goals: ["a", 1], weekly_focus_hours: 4 }).goals).toEqual(["a"]);
	});
});

describe("resume review", () => {
	const extract = {
		profile: { full_name: "Jordan Lee", location: "Austin, TX", summary: "" },
		skills: ["TypeScript", "React", ""],
		work_experience: [{ role: "Software Engineer", company: "Acme" }],
		education: [],
	};

	it("builds rows only for fields with values", () => {
		const rows = buildResumeReviewRows(extract);
		expect(rows.map((r) => r.field)).toEqual(["full_name", "location", "skills", "work_experience"]);
		expect(rows.find((r) => r.field === "work_experience")?.preview).toBe("Software Engineer at Acme");
		expect(buildResumeReviewRows(null)).toEqual([]);
	});

	it("sends only ticked fields", () => {
		const rows = buildResumeReviewRows(extract);
		const selected = new Set<ReviewField>(["skills"]);
		expect(selectedFields(rows, selected)).toEqual({ skills: ["TypeScript", "React"] });
	});

	it("suggests the latest role", () => {
		expect(suggestedRole(buildResumeReviewRows(extract))).toBe("Software Engineer");
		expect(suggestedRole([])).toBeNull();
	});
});

describe("salary display", () => {
	it("shows USD with a dollar sign", () => {
		expect(formatSalary({ salary_min: 120000, salary_max: 150000, currency: "USD" })).toBe("$120k–$150k/yr");
		expect(formatSalary({ salary_min: 90000, salary_max: null, currency: "EUR" })).toBe("EUR 90k/yr");
	});
});
