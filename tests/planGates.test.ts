import { describe, expect, it } from "vitest";
import {
	PLAN_REQUIRED_CODE,
	UPGRADE_HREF,
	afterReview,
	feedbackLimitReachedText,
	feedbackQuota,
	feedbackRemainingText,
	gateMessage,
	planRequiredBody,
} from "@/lib/billing/gates";
import { blockedAttemptFeature, buildPrepAccess, canGetFeedback, feedbackIsMetered } from "@/lib/prep/access";
import { buildPathAccess, isPathUnlocked, startedPathOrder } from "@/lib/learn/access";

const free = { plan: "free" as const, hasOwnAiKey: false, billingEnabled: true };
const freeOwnKey = { plan: "free" as const, hasOwnAiKey: true, billingEnabled: true };
const pro = { plan: "pro" as const, hasOwnAiKey: false, billingEnabled: true };
const billingOff = { plan: "free" as const, hasOwnAiKey: false, billingEnabled: false };

describe("gate copy and response body", () => {
	it("builds a 403 body with a code and the upgrade link", () => {
		const body = planRequiredBody("mock_interviews");
		expect(body).toEqual({
			error: gateMessage("mock_interviews"),
			code: PLAN_REQUIRED_CODE,
			feature: "mock_interviews",
			upgradeUrl: UPGRADE_HREF,
		});
		expect(UPGRADE_HREF).toBe("/pricing");
	});

	it("words the feedback quota plainly", () => {
		expect(feedbackRemainingText(feedbackQuota(10, 4))).toBe("6 of 10 free AI reviews left this month.");
		expect(feedbackRemainingText(null)).toBeNull();
		expect(feedbackLimitReachedText(10)).toContain("You've used your 10 free reviews this month");
		expect(feedbackLimitReachedText(10)).toContain("Your answer is saved");
	});

	it("never shows a negative remaining count and counts only given reviews", () => {
		expect(feedbackQuota(10, 14)?.remaining).toBe(0);
		expect(feedbackQuota(null, 3)).toBeNull();
		expect(afterReview(feedbackQuota(10, 9), true)).toEqual({ limit: 10, used: 10, remaining: 0 });
		expect(afterReview(feedbackQuota(10, 9), false)).toEqual({ limit: 10, used: 9, remaining: 1 });
		expect(afterReview(null, true)).toBeNull();
	});
});

describe("interview prep gates", () => {
	it("caps Free AI feedback at 10 a month", () => {
		expect(feedbackIsMetered(free)).toBe(true);
		expect(canGetFeedback(buildPrepAccess(free, 9))).toBe(true);
		expect(canGetFeedback(buildPrepAccess(free, 10))).toBe(false);
	});

	it("keeps AI feedback unlimited with an own key, on Pro and with billing off", () => {
		for (const ctx of [freeOwnKey, pro, billingOff]) {
			expect(feedbackIsMetered(ctx)).toBe(false);
			expect(buildPrepAccess(ctx, 500).feedback).toBeNull();
		}
	});

	it("makes voice answers and mocks Pro, with typed practice always allowed", () => {
		const access = buildPrepAccess(free, 0);
		expect(access.voice).toBe(false);
		expect(access.mock).toBe(false);
		expect(blockedAttemptFeature(access, { inputMode: "voice" })).toBe("voice_answers");
		expect(blockedAttemptFeature(access, { inputMode: "text", mockId: "m1" })).toBe("mock_interviews");
		expect(blockedAttemptFeature(access, { inputMode: "text" })).toBeNull();
		// An own key unlocks AI volume, not Pro-only features.
		expect(buildPrepAccess(freeOwnKey, 0).voice).toBe(false);
	});

	it("opens voice and mocks for Pro and when billing is off", () => {
		for (const ctx of [pro, billingOff]) {
			const access = buildPrepAccess(ctx, 0);
			expect(blockedAttemptFeature(access, { inputMode: "voice", mockId: "m1" })).toBeNull();
		}
	});
});

describe("learning path gate", () => {
	it("orders paths by their earliest lesson start", () => {
		const order = startedPathOrder([
			{ pathId: "b", startedAt: "2026-10-05T00:00:00Z" },
			{ pathId: "a", startedAt: "2026-10-03T00:00:00Z" },
			{ pathId: "b", startedAt: "2026-10-01T00:00:00Z" },
			{ pathId: "c", startedAt: "not a date" },
		]);
		expect(order).toEqual(["b", "a", "c"]);
	});

	it("lets Free start any one path before they have started one", () => {
		const access = buildPathAccess(free, []);
		expect(access.canStartNew).toBe(true);
		expect(isPathUnlocked(access, "anything")).toBe(true);
	});

	it("keeps only the first started path open on Free", () => {
		const access = buildPathAccess(free, ["first", "second"]);
		expect(access.unlocked).toEqual(["first"]);
		expect(isPathUnlocked(access, "first")).toBe(true);
		expect(isPathUnlocked(access, "second")).toBe(false);
		expect(isPathUnlocked(access, "new")).toBe(false);
		expect(isPathUnlocked(buildPathAccess(freeOwnKey, ["first"]), "new")).toBe(false);
	});

	it("opens every path on Pro and when billing is off", () => {
		for (const ctx of [pro, billingOff]) {
			const access = buildPathAccess(ctx, ["first", "second"]);
			expect(access.limit).toBeNull();
			expect(isPathUnlocked(access, "second")).toBe(true);
			expect(isPathUnlocked(access, "new")).toBe(true);
		}
	});
});
