import { describe, expect, it } from "vitest";
import { isMissingTableError, normalizeReport, normalizeReports } from "@/lib/adminModeration";
import { OWNER_EMAIL, temporaryPasswordProblem } from "@/lib/adminOwner";

describe("moderation queue helpers", () => {
	it("treats a missing content_reports table as an empty queue", () => {
		expect(isMissingTableError({ code: "42P01" })).toBe(true);
		expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
		expect(isMissingTableError({ code: "42501" })).toBe(false);
		expect(isMissingTableError(null)).toBe(false);
	});

	it("normalizes loosely shaped report rows", () => {
		expect(
			normalizeReport({
				id: "r1",
				category: "spam",
				content_type: "post",
				note: "  Selling followers  ",
				created_at: "2026-10-01T12:00:00Z",
			})
		).toEqual({
			id: "r1",
			reason: "spam",
			status: "open",
			targetType: "post",
			details: "Selling followers",
			createdAt: "2026-10-01T12:00:00Z",
		});
	});

	it("drops rows without an id and non-object values", () => {
		expect(normalizeReports([{ reason: "spam" }, null, "x", { id: "r2" }])).toHaveLength(1);
		expect(normalizeReports(null)).toEqual([]);
	});
});

describe("owner temporary password", () => {
	it("targets the seeded owner email", () => {
		expect(OWNER_EMAIL).toBe("hello@himanshurawat.in");
	});

	it("requires a long, non-repetitive password", () => {
		expect(temporaryPasswordProblem(undefined)).toMatch(/OWNER_TEMP_PASSWORD/);
		expect(temporaryPasswordProblem("short")).toMatch(/at least 12/);
		expect(temporaryPasswordProblem("aaaaaaaaaaaaaaaa")).toMatch(/repetitive/);
		expect(temporaryPasswordProblem("correct-horse-battery")).toBeNull();
	});
});
