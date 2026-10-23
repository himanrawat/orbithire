import { describe, expect, it } from "vitest";
import {
	MAX_PLAN_ITEMS,
	MIN_PLAN_ITEMS,
	buildDailyPlan,
	carryOverDone,
	localDateKey,
	pickNextStep,
	safeTimeZone,
	toggleItem,
	type TodaySignals,
} from "@/lib/today/nextStep";
import { focusProgress } from "@/lib/today/focus";
import { parseStoredItems, planPatchSchema } from "@/lib/today/schema";

// 2026-10-23 14:00 UTC = 10:00 AM in New York.
const NOW = new Date("2026-10-23T14:00:00Z");
const TZ = "America/New_York";
const HOUR = 3_600_000;

function at(hoursFromNow: number): string {
	return new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString();
}

function signals(overrides: Partial<TodaySignals> = {}): TodaySignals {
	return {
		now: NOW,
		timeZone: TZ,
		interviews: [],
		followUps: [],
		lesson: null,
		strongMatchCount: 0,
		...overrides,
	};
}

const interview = (hours: number, companyId = "c1") => ({ companyId, companyName: "Acme", interviewAt: at(hours) });
const followUp = (dueAt: string, id = "f1") => ({ id, companyId: "c2", companyName: "Globex", dueAt });
const lesson = { id: "l1", title: "Big-O basics", href: "/learn/lessons/l1" };

describe("pickNextStep", () => {
	it("prefers an interview within 3 days over everything else", () => {
		const step = pickNextStep(
			signals({
				interviews: [interview(48)],
				followUps: [followUp(NOW.toISOString())],
				lesson,
				strongMatchCount: 3,
			})
		);
		expect(step.kind).toBe("interview_prep");
		expect(step.href).toBe("/companies/c1");
		expect(step.title).toContain("Acme");
	});

	it("ignores past interviews and ones more than 3 days out", () => {
		expect(pickNextStep(signals({ interviews: [interview(80), interview(-1, "c0")] })).kind).toBe("focus_block");
	});

	it("uses a follow-up due today or overdue, in the user's time zone", () => {
		expect(pickNextStep(signals({ followUps: [followUp(at(-24))] })).kind).toBe("follow_up");
		// 11 PM in New York is still today.
		expect(pickNextStep(signals({ followUps: [followUp("2026-10-24T03:00:00Z")] })).kind).toBe("follow_up");
		// 1 AM in New York on the 24th is tomorrow.
		expect(pickNextStep(signals({ followUps: [followUp("2026-10-24T05:00:00Z")] })).kind).toBe("focus_block");
	});

	it("falls through lesson, then strong matches, then a focus block", () => {
		expect(pickNextStep(signals({ lesson, strongMatchCount: 2 })).kind).toBe("lesson");
		expect(pickNextStep(signals({ strongMatchCount: 2 })).title).toBe("Review 2 strong matches");
		expect(pickNextStep(signals({ strongMatchCount: 1 })).title).toBe("Review 1 strong match");
		expect(pickNextStep(signals()).kind).toBe("focus_block");
	});
});

describe("buildDailyPlan", () => {
	it("tops up a quiet day to the minimum", () => {
		const plan = buildDailyPlan(signals());
		expect(plan).toHaveLength(MIN_PLAN_ITEMS);
		expect(plan.map((i) => i.kind)).toEqual(["focus_block", "job_inbox", "profile"]);
	});

	it("caps a busy day, keeps the next step first and a focus block last", () => {
		const busy = signals({
			interviews: [interview(5, "a"), interview(30, "b")],
			followUps: [followUp(NOW.toISOString(), "x"), followUp(NOW.toISOString(), "y")],
			lesson,
			strongMatchCount: 4,
		});
		const plan = buildDailyPlan(busy);
		expect(plan).toHaveLength(MAX_PLAN_ITEMS);
		expect(plan[0]).toEqual(pickNextStep(busy));
		expect(plan.at(-1)?.kind).toBe("focus_block");
		expect(new Set(plan.map((i) => i.id)).size).toBe(plan.length);
		expect(plan.every((i) => !i.done)).toBe(true);
	});
});

describe("plan helpers", () => {
	it("keeps check-offs across a regenerate", () => {
		const before = toggleItem(buildDailyPlan(signals()), "job_inbox", true);
		expect(before).not.toBeNull();
		const after = carryOverDone(
			buildDailyPlan(signals({ interviews: [interview(5)], lesson })),
			before ?? []
		);
		expect(after.find((i) => i.id === "job_inbox")).toBeUndefined();
		expect(after.every((i) => !i.done)).toBe(true);
		const same = carryOverDone(buildDailyPlan(signals()), before ?? []);
		expect(same.find((i) => i.id === "job_inbox")?.done).toBe(true);
	});

	it("refuses to toggle an unknown item", () => {
		expect(toggleItem(buildDailyPlan(signals()), "nope", true)).toBeNull();
	});

	it("handles time zones safely", () => {
		expect(safeTimeZone("Not/AZone")).toBe(TZ);
		expect(safeTimeZone(null)).toBe(TZ);
		expect(localDateKey(new Date("2026-10-24T03:00:00Z"), TZ)).toBe("2026-10-23");
		expect(localDateKey(new Date("2026-10-24T03:00:00Z"), "UTC")).toBe("2026-10-24");
	});
});

describe("Today schemas", () => {
	it("parses stored items and drops malformed values", () => {
		const plan = buildDailyPlan(signals());
		expect(parseStoredItems(plan)).toEqual(plan);
		expect(parseStoredItems([{ id: "x" }])).toEqual([]);
		expect(parseStoredItems("nope")).toEqual([]);
	});

	it("only keeps in-app links in stored items", () => {
		const [item] = buildDailyPlan(signals());
		for (const href of ["javascript:alert(1)", "https://evil.test", "//evil.test", "/\\evil.test"]) {
			expect(parseStoredItems([{ ...item, href }])).toEqual([]);
		}
		expect(parseStoredItems([{ ...item, href: "/jobs" }])).toHaveLength(1);
	});

	it("validates PATCH bodies", () => {
		expect(planPatchSchema.safeParse({ action: "toggle", itemId: "focus_block", done: true }).success).toBe(true);
		expect(planPatchSchema.safeParse({ action: "dismiss_next_step" }).success).toBe(true);
		expect(planPatchSchema.safeParse({ action: "toggle", itemId: "", done: true }).success).toBe(false);
		expect(planPatchSchema.safeParse({ action: "delete" }).success).toBe(false);
	});
});

describe("focusProgress", () => {
	it("shows hours against the goal without streaks", () => {
		expect(focusProgress({ minutes: 90, goalHours: 5 })).toEqual({ label: "1.5 of 5 hours", percent: 30 });
		expect(focusProgress({ minutes: 600, goalHours: 5 }).percent).toBe(100);
		expect(focusProgress({ minutes: 60, goalHours: null })).toEqual({ label: "1 hour", percent: null });
	});
});
