import { describe, expect, it } from "vitest";
import { activeDayCount, buildWeek, greetingFor, weekStartKey } from "@/lib/today/week";

describe("today week strip", () => {
	it("starts the week on Monday", () => {
		expect(weekStartKey("2026-10-24")).toBe("2026-10-19"); // Saturday
		expect(weekStartKey("2026-10-19")).toBe("2026-10-19"); // Monday
		expect(weekStartKey("2026-10-25")).toBe("2026-10-19"); // Sunday
	});

	it("crosses a month boundary", () => {
		expect(weekStartKey("2026-11-01")).toBe("2026-10-26");
	});

	it("marks active, today, open and upcoming days", () => {
		const week = buildWeek("2026-10-22", new Set(["2026-10-19", "2026-10-20"]));
		expect(week.map((d) => d.state)).toEqual(["active", "active", "open", "today", "upcoming", "upcoming", "upcoming"]);
		expect(week.map((d) => d.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
		expect(activeDayCount(week)).toBe(2);
	});

	it("shows today as active once something is done", () => {
		const week = buildWeek("2026-10-22", new Set(["2026-10-22"]));
		expect(week[3].state).toBe("active");
	});
});

describe("today greeting", () => {
	it("uses the hour in the person's time zone", () => {
		const now = new Date("2026-10-23T14:00:00Z"); // 10 AM New York, 7 AM Los Angeles
		expect(greetingFor(now, "America/New_York", "Maya")).toBe("Good morning, Maya");
		expect(greetingFor(new Date("2026-10-23T20:00:00Z"), "America/New_York", "Maya")).toBe("Good afternoon, Maya");
		expect(greetingFor(new Date("2026-10-24T02:00:00Z"), "America/New_York", null)).toBe("Good evening");
	});
});
