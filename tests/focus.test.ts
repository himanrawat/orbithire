import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	finishTimer,
	formatClock,
	isFinished,
	newClientId,
	parseTimerState,
	pauseTimer,
	remainingMs,
	resumeTimer,
	startTimer,
} from "@/lib/focus/timer";
import { createOfflineQueue, shouldDropBatch } from "@/lib/focus/offlineQueue";
import { createBlockSchema, focusSessionSchema, parseRange, updateBlockSchema } from "@/lib/focus/schemas";
import { sessionMinutes, totalSessionMinutes } from "@/lib/focus/totals";
import { addDays, formatMinutes, fromDateTimeInputs, itemsOnDay, startOfWeek, toDateInput, toTimeInput } from "@/lib/focus/week";
import { blockToEvent, toExternalEvent } from "@/lib/calendar/google/calendarApi";
import { buildAuthorizeUrl, codeChallenge, createOAuthState, isExpiring, toTokens, verifyOAuthState } from "@/lib/calendar/google/oauth";

const T0 = Date.UTC(2026, 9, 26, 14, 0, 0);
const MIN = 60_000;

describe("focus timer", () => {
	const start = () => startTimer({ taskLabel: "  Rate limiter  ", plannedMinutes: 25, clientId: "c1" }, T0);

	it("counts down from timestamps", () => {
		const timer = start();
		expect(timer.taskLabel).toBe("Rate limiter");
		expect(remainingMs(timer, T0 + 5 * MIN)).toBe(20 * MIN);
		expect(isFinished(timer, T0 + 25 * MIN)).toBe(true);
	});

	it("excludes paused time", () => {
		const paused = pauseTimer(start(), T0 + 10 * MIN);
		expect(remainingMs(paused, T0 + 60 * MIN)).toBe(15 * MIN);
		const resumed = resumeTimer(paused, T0 + 60 * MIN);
		expect(remainingMs(resumed, T0 + 65 * MIN)).toBe(10 * MIN);
	});

	it("records completion at the moment it hit zero, even after a late reload", () => {
		const record = finishTimer(start(), T0 + 3 * 60 * MIN);
		expect(record?.completed).toBe(true);
		expect(record?.focused_seconds).toBe(25 * 60);
		expect(record?.ended_at).toBe(new Date(T0 + 25 * MIN).toISOString());
	});

	it("drops sessions stopped in under a minute, keeps longer early stops", () => {
		expect(finishTimer(start(), T0 + 30_000)).toBeNull();
		const early = finishTimer(start(), T0 + 5 * MIN);
		expect(early?.completed).toBe(false);
		expect(early?.focused_seconds).toBe(300);
	});

	it("round-trips through storage validation", () => {
		const timer = start();
		expect(parseTimerState(JSON.parse(JSON.stringify(timer)))).toEqual(timer);
		expect(parseTimerState({ ...timer, plannedMinutes: 30 })).toBeNull();
		expect(parseTimerState("nope")).toBeNull();
	});

	it("formats the clock", () => {
		expect(formatClock(25 * MIN)).toBe("25:00");
		expect(formatClock(59_001)).toBe("1:00");
		expect(formatClock(90 * MIN)).toBe("1:30:00");
	});

	it("makes v4 UUIDs", () => {
		expect(newClientId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});

describe("offline queue", () => {
	let store: Record<string, string>;

	beforeEach(() => {
		store = {};
		const localStorage = {
			getItem: (k: string) => store[k] ?? null,
			setItem: (k: string, v: string) => {
				store[k] = v;
			},
			removeItem: (k: string) => {
				delete store[k];
			},
		};
		vi.stubGlobal("window", { localStorage, addEventListener: vi.fn(), removeEventListener: vi.fn() });
		vi.stubGlobal("navigator", { onLine: true });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	type Item = { id: string; n: number };
	const makeQueue = () =>
		createOfflineQueue<Item>({
			storageKey: "q",
			endpoint: "/api/x",
			bodyField: "items",
			keyOf: (i) => i.id,
			isItem: (v): v is Item => typeof (v as Item)?.id === "string",
		});

	it("de-duplicates by key and clears sent items", async () => {
		const queue = makeQueue();
		queue.enqueue({ id: "a", n: 1 });
		queue.enqueue({ id: "a", n: 2 });
		queue.enqueue({ id: "b", n: 3 });
		expect(queue.read()).toEqual([
			{ id: "a", n: 2 },
			{ id: "b", n: 3 },
		]);
		const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
		const result = await queue.flush(fetchImpl as unknown as typeof fetch);
		expect(result).toEqual({ sent: 2, remaining: 0, ok: true });
		expect(JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).items).toHaveLength(2);
	});

	it("keeps items on network and server errors", async () => {
		const queue = makeQueue();
		queue.enqueue({ id: "a", n: 1 });
		await queue.flush((async () => {
			throw new Error("offline");
		}) as unknown as typeof fetch);
		await queue.flush((async () => new Response("{}", { status: 503 })) as unknown as typeof fetch);
		expect(queue.read()).toHaveLength(1);
	});

	it("skips flushing while offline", async () => {
		vi.stubGlobal("navigator", { onLine: false });
		const queue = makeQueue();
		queue.enqueue({ id: "a", n: 1 });
		const fetchImpl = vi.fn();
		await queue.flush(fetchImpl as unknown as typeof fetch);
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("drops batches the server will never accept", () => {
		expect(shouldDropBatch(400)).toBe(true);
		expect(shouldDropBatch(401)).toBe(false);
		expect(shouldDropBatch(429)).toBe(false);
		expect(shouldDropBatch(500)).toBe(false);
	});
});

describe("schemas", () => {
	const session = {
		client_id: "6f1c8a3e-2b4d-4c5e-9f00-1234567890ab",
		task_label: "Rate limiter",
		planned_minutes: 25,
		focused_seconds: 1500,
		started_at: "2026-10-01T14:00:00.000Z",
		ended_at: "2026-10-01T14:25:00.000Z",
		completed: true,
	};

	it("accepts valid sessions and rejects bad ones", () => {
		expect(focusSessionSchema.safeParse(session).success).toBe(true);
		expect(focusSessionSchema.safeParse({ ...session, planned_minutes: 30 }).success).toBe(false);
		expect(focusSessionSchema.safeParse({ ...session, ended_at: "2026-10-01T13:00:00.000Z" }).success).toBe(false);
		expect(focusSessionSchema.safeParse({ ...session, extra: 1 }).success).toBe(false);
	});

	it("validates blocks", () => {
		const block = { kind: "focus", title: "Deep work", starts_at: "2026-10-26T14:00:00Z", ends_at: "2026-10-26T15:00:00Z" };
		expect(createBlockSchema.safeParse(block).success).toBe(true);
		expect(createBlockSchema.safeParse({ ...block, kind: "nap" }).success).toBe(false);
		expect(createBlockSchema.safeParse({ ...block, ends_at: block.starts_at }).success).toBe(false);
		expect(updateBlockSchema.safeParse({ starts_at: block.starts_at }).success).toBe(false);
		expect(updateBlockSchema.safeParse({ title: "Renamed" }).success).toBe(true);
	});

	it("parses and caps ranges", () => {
		expect(parseRange(new URLSearchParams({ start: "2026-10-26T00:00:00Z", end: "2026-11-02T00:00:00Z" }))).not.toBeNull();
		expect(parseRange(new URLSearchParams({ start: "2026-10-26T00:00:00Z", end: "2027-01-01T00:00:00Z" }))).toBeNull();
		expect(parseRange(new URLSearchParams({ start: "x", end: "y" }))).toBeNull();
	});
});

describe("totals and week math", () => {
	it("counts focused time, falling back to the plan", () => {
		expect(sessionMinutes({ focused_seconds: 1490, planned_minutes: 25, completed: true })).toBe(25);
		expect(sessionMinutes({ focused_seconds: null, planned_minutes: 50, completed: true })).toBe(50);
		expect(sessionMinutes({ focused_seconds: null, planned_minutes: 50, completed: false })).toBe(0);
		expect(
			totalSessionMinutes([
				{ focused_seconds: 600, planned_minutes: 25, completed: false },
				{ focused_seconds: 1500, planned_minutes: 25, completed: true },
			])
		).toBe(35);
	});

	it("starts weeks on Monday", () => {
		const sunday = new Date(2026, 10, 1, 12);
		expect(toDateInput(startOfWeek(sunday))).toBe("2026-10-26");
		expect(toDateInput(startOfWeek(new Date(2026, 9, 26, 8)))).toBe("2026-10-26");
		expect(toDateInput(addDays(new Date(2026, 9, 26), 6))).toBe("2026-11-01");
	});

	it("converts input values", () => {
		const date = fromDateTimeInputs("2026-10-26", "09:30");
		expect(date && toTimeInput(date)).toBe("09:30");
		expect(fromDateTimeInputs("10/26/2026", "09:30")).toBeNull();
	});

	it("groups items by day in time order", () => {
		const day = new Date(2026, 9, 26);
		const items = [
			{ id: "b", starts_at: new Date(2026, 9, 26, 15).toISOString() },
			{ id: "a", starts_at: new Date(2026, 9, 26, 9).toISOString() },
			{ id: "c", starts_at: new Date(2026, 9, 27, 9).toISOString() },
		];
		expect(itemsOnDay(items, day).map((i) => i.id)).toEqual(["a", "b"]);
	});

	it("formats minutes", () => {
		expect(formatMinutes(45)).toBe("45 min");
		expect(formatMinutes(120)).toBe("2 hr");
		expect(formatMinutes(90)).toBe("1 hr 30 min");
	});
});

describe("google calendar helpers", () => {
	const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://app.example.com/api/calendar/google/callback" };

	it("builds an authorize URL with state, PKCE and narrow scopes", () => {
		const { state, verifier } = createOAuthState();
		const url = new URL(buildAuthorizeUrl(config, state, verifier));
		expect(url.searchParams.get("state")).toBe(state);
		expect(url.searchParams.get("code_challenge")).toBe(codeChallenge(verifier));
		expect(url.searchParams.get("access_type")).toBe("offline");
		const scope = url.searchParams.get("scope") ?? "";
		expect(scope).toContain("calendar.events.readonly");
		expect(scope).toContain("calendar.app.created");
		expect(scope).not.toMatch(/auth\/calendar(\s|$)/);
	});

	it("verifies the state cookie", () => {
		const { state, verifier, cookieValue } = createOAuthState();
		expect(verifyOAuthState(cookieValue, state)).toBe(verifier);
		expect(verifyOAuthState(cookieValue, `${state}x`)).toBeNull();
		expect(verifyOAuthState(undefined, state)).toBeNull();
	});

	it("maps token responses and keeps the old refresh token", () => {
		const tokens = toTokens({ access_token: "at", expires_in: 3600, scope: "s" }, T0, "rt");
		expect(tokens).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: new Date(T0 + 3_600_000).toISOString(), scope: "s" });
		expect(() => toTokens({ error: "invalid_grant" }, T0)).toThrow();
		expect(isExpiring(new Date(T0 + 30_000).toISOString(), T0)).toBe(true);
		expect(isExpiring(new Date(T0 + 3_600_000).toISOString(), T0)).toBe(false);
	});

	it("maps events both ways", () => {
		expect(
			toExternalEvent({ id: "e1", summary: "Standup", start: { dateTime: "2026-10-26T09:00:00-04:00" }, end: { dateTime: "2026-10-26T09:15:00-04:00" } })
		).toEqual({ id: "e1", title: "Standup", starts_at: "2026-10-26T13:00:00.000Z", ends_at: "2026-10-26T13:15:00.000Z", all_day: false });
		expect(toExternalEvent({ id: "e2", status: "cancelled", start: { date: "2026-10-26" }, end: { date: "2026-10-27" } })).toBeNull();
		const event = blockToEvent({ id: "b1", kind: "prep", title: "Mock interview", starts_at: "2026-10-26T14:00:00Z", ends_at: "2026-10-26T15:00:00Z" });
		expect(event.summary).toBe("Mock interview");
		expect(event.extendedProperties.private.nextmilestoneBlockId).toBe("b1");
	});
});
