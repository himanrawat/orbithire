import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabaseServer", () => ({ createServerSupabase: vi.fn() }));

import type { PracticeAttempt, PrepQuestion } from "@/lib/prep/constants";
import { PREP_TOPICS } from "@/lib/prep/constants";
import { buildFeedbackPrompt, parseFeedback } from "@/lib/prep/feedback";
import { EMPTY_FILTERS, activeFilterCount, filtersForInterview, filtersToQuery } from "@/lib/prep/filters";
import { frameworkForTopic } from "@/lib/prep/frameworks";
import { checklistProgress, defaultChecklist, toggleChecklistItem, upcomingOnly } from "@/lib/prep/interviews";
import { formatClock, pickMockQuestions, summarizeMock } from "@/lib/prep/mock";
import {
	attemptCreateSchema,
	interviewPatchSchema,
	parseQuestionFilters,
	parseStoredChecklist,
	questionReportSchema,
} from "@/lib/prep/schema";
import { countFeedbackThisMonth, startOfMonthUtc, toQuestion } from "@/lib/prep/server";
import {
	collectTranscript,
	getSpeechRecognitionCtor,
	pickTranscriptionProvider,
	speechErrorMessage,
	type TranscriptionProvider,
} from "@/lib/prep/transcription";
import { mergeInterviewSignals } from "@/lib/today/server";
import { PROMPT_VERSIONS } from "@/lib/prompts/versions";
import { EXPORT_TABLES } from "@/lib/account/export";

function question(overrides: Partial<PrepQuestion> = {}): PrepQuestion {
	return {
		id: overrides.id ?? "q1",
		slug: "q",
		role: "frontend_engineer",
		topic: "behavioral",
		level: "mid",
		stages: ["onsite"],
		companyTypes: [],
		prompt: "Tell me about a time you failed.",
		frameworkHint: "STAR. Own it.",
		mostAsked: false,
		sourceKind: "curated",
		sourceNote: "NextMilestone curated set (Oct 2026)",
		...overrides,
	};
}

const GOOD = {
	strength: "You named the impact.",
	gap: "Say what you did, not the team.",
	nextRead: { title: "STAR method", detail: "It keeps stories short." },
};

describe("parseFeedback", () => {
	it("accepts exactly one strength, gap and next read", () => {
		expect(parseFeedback(JSON.stringify(GOOD))).toEqual(GOOD);
	});

	it("tolerates code fences and surrounding prose", () => {
		expect(parseFeedback("```json\n" + JSON.stringify(GOOD) + "\n```")).toEqual(GOOD);
	});

	it("rejects extra keys, arrays and missing fields", () => {
		expect(parseFeedback(JSON.stringify({ ...GOOD, score: 7 }))).toBeNull();
		expect(parseFeedback(JSON.stringify({ ...GOOD, strength: ["a", "b"] }))).toBeNull();
		expect(parseFeedback(JSON.stringify({ strength: "a", gap: "b" }))).toBeNull();
		expect(parseFeedback("not json")).toBeNull();
		expect(parseFeedback("{".repeat(10_000))).toBeNull();
	});
});

describe("buildFeedbackPrompt", () => {
	it("includes the question, framework and answer", () => {
		const prompt = buildFeedbackPrompt(question(), "I broke prod once.");
		expect(prompt).toContain("Tell me about a time you failed.");
		expect(prompt).toContain("STAR");
		expect(prompt).toContain("I broke prod once.");
		expect(prompt).not.toContain("\n\n\n");
	});

	it("is versioned", () => {
		expect(PROMPT_VERSIONS.prep_feedback).toMatch(/^prep_feedback@/);
	});
});

describe("frameworks", () => {
	it("maps every topic", () => {
		for (const topic of PREP_TOPICS) expect(frameworkForTopic(topic).steps.length).toBeGreaterThan(0);
		expect(frameworkForTopic("behavioral").id).toBe("star");
		expect(frameworkForTopic("system_design").steps.map((s) => s.label)).toEqual([
			"Requirements",
			"API",
			"Data",
			"Scale",
		]);
	});
});

describe("filters", () => {
	it("round-trips through the query string", () => {
		const state = { ...EMPTY_FILTERS, topic: "react", mostAsked: true };
		const query = filtersToQuery(state);
		expect(query).toBe("topic=react&mostAsked=true");
		expect(parseQuestionFilters(new URLSearchParams(query))).toEqual({ topic: "react", mostAsked: true });
		expect(activeFilterCount(state)).toBe(2);
	});

	it("rejects unknown values", () => {
		expect(parseQuestionFilters(new URLSearchParams("topic=cooking"))).toBeNull();
		expect(parseQuestionFilters(new URLSearchParams(""))).toEqual({});
	});

	it("matches an interview card's round and company type", () => {
		expect(filtersForInterview({ round: "system_design", companyType: "big_tech" })).toMatchObject({
			stage: "system_design",
			companyType: "big_tech",
		});
		expect(filtersForInterview({ round: "other", companyType: null }).stage).toBe("");
	});
});

describe("schemas", () => {
	it("validates attempts", () => {
		const id = "3f1c2b4a-1111-4222-8333-444455556666";
		expect(attemptCreateSchema.safeParse({ questionId: id, answerText: "hi", inputMode: "voice" }).success).toBe(true);
		expect(attemptCreateSchema.safeParse({ questionId: id, answerText: "  ", inputMode: "text" }).success).toBe(false);
		expect(attemptCreateSchema.safeParse({ questionId: "x", answerText: "a", inputMode: "text" }).success).toBe(false);
		expect(attemptCreateSchema.safeParse({ questionId: id, answerText: "a", inputMode: "video" }).success).toBe(false);
	});

	it("validates reports and interview patches", () => {
		expect(questionReportSchema.safeParse({ prompt: "short" }).success).toBe(false);
		expect(questionReportSchema.safeParse({ prompt: "Design a feed for a news app." }).success).toBe(true);
		expect(interviewPatchSchema.safeParse({}).success).toBe(false);
		expect(interviewPatchSchema.safeParse({ round: "onsite" }).success).toBe(true);
	});

	it("drops a malformed stored checklist", () => {
		expect(parseStoredChecklist([{ id: "a", label: "x", done: "yes" }])).toEqual([]);
		expect(parseStoredChecklist([{ id: "a", label: "x", done: true, extra: 1 }])).toEqual([
			{ id: "a", label: "x", done: true },
		]);
	});
});

describe("interview checklist", () => {
	it("builds a default per round and toggles items", () => {
		const list = defaultChecklist("system_design");
		expect(list.length).toBeGreaterThanOrEqual(4);
		expect(new Set(list.map((i) => i.id)).size).toBe(list.length);
		const toggled = toggleChecklistItem(list, list[0].id, true);
		expect(checklistProgress(toggled)).toEqual({ done: 1, total: list.length });
	});

	it("keeps upcoming interviews only, soonest first", () => {
		const now = new Date("2026-10-23T12:00:00Z");
		const card = (id: string, at: string) => ({
			id,
			companyId: id,
			companyName: id,
			scheduledAt: at,
			round: "onsite" as const,
			companyType: null,
			checklist: [],
			notes: null,
		});
		const result = upcomingOnly([card("b", "2026-10-25T00:00:00Z"), card("past", "2026-10-22T00:00:00Z"), card("a", "2026-10-24T00:00:00Z")], now);
		expect(result.map((c) => c.id)).toEqual(["a", "b"]);
	});
});

describe("mock interview", () => {
	const pool: PrepQuestion[] = [
		question({ id: "b1", topic: "behavioral", mostAsked: true }),
		question({ id: "b2", topic: "behavioral" }),
		question({ id: "j1", topic: "javascript" }),
		question({ id: "r1", topic: "react", mostAsked: true }),
		question({ id: "s1", topic: "system_design" }),
	];

	it("picks 3-4 distinct questions in interview order", () => {
		const picked = pickMockQuestions(pool, 4, () => 0.5);
		expect(picked).toHaveLength(4);
		expect(new Set(picked.map((q) => q.id)).size).toBe(4);
		expect(picked[0].topic).toBe("behavioral");
		expect(["javascript", "react", "web_fundamentals"]).toContain(picked[1].topic);
		expect(picked[2].topic).toBe("system_design");
		expect(pickMockQuestions(pool, 1, () => 0.1)).toHaveLength(3);
	});

	it("stops when the pool runs out", () => {
		expect(pickMockQuestions(pool.slice(0, 2), 4)).toHaveLength(2);
	});

	it("summarizes feedback", () => {
		const attempt = (feedback: PracticeAttempt["feedback"]): PracticeAttempt => ({
			id: "a",
			questionId: "q",
			answerText: "x",
			inputMode: "text",
			feedback,
			feedbackModel: null,
			flaggedWrong: false,
			mockId: "m",
			createdAt: "",
		});
		const summary = summarizeMock(4, [attempt(GOOD), attempt(null)]);
		expect(summary).toEqual({
			answered: 2,
			total: 4,
			strengths: [GOOD.strength],
			gaps: [GOOD.gap],
			nextReads: [GOOD.nextRead.title],
		});
	});

	it("formats the clock", () => {
		expect(formatClock(1800)).toBe("30:00");
		expect(formatClock(65)).toBe("1:05");
		expect(formatClock(-3)).toBe("0:00");
	});
});

describe("transcription", () => {
	it("detects the Web Speech API, including the webkit prefix", () => {
		class Fake {}
		expect(getSpeechRecognitionCtor(null)).toBeNull();
		expect(getSpeechRecognitionCtor({})).toBeNull();
		expect(getSpeechRecognitionCtor({ webkitSpeechRecognition: Fake })).toBe(Fake);
	});

	it("falls back to typing when nothing is supported", () => {
		const unsupported: TranscriptionProvider = {
			id: "deepgram",
			label: "x",
			isSupported: () => false,
			start: () => ({ stop: () => undefined }),
		};
		expect(pickTranscriptionProvider([unsupported])).toBeNull();
		expect(pickTranscriptionProvider()).toBeNull(); // no window in node
	});

	it("splits final and interim text", () => {
		const r = (transcript: string, isFinal: boolean) => ({ isFinal, 0: { transcript }, length: 1 });
		expect(collectTranscript([r("I built ", true), r("a feed", true), r(" with", false)])).toEqual({
			finalText: "I built a feed",
			interimText: "with",
		});
		expect(speechErrorMessage("not-allowed")).toContain("Microphone");
		expect(speechErrorMessage("weird")).toContain("keep editing");
	});
});

describe("countFeedbackThisMonth", () => {
	it("counts this month's attempts with feedback for the user", async () => {
		const calls: unknown[][] = [];
		const builder = {
			select: (...a: unknown[]) => (calls.push(["select", ...a]), builder),
			eq: (...a: unknown[]) => (calls.push(["eq", ...a]), builder),
			not: (...a: unknown[]) => (calls.push(["not", ...a]), builder),
			gte: (...a: unknown[]) => {
				calls.push(["gte", ...a]);
				return Promise.resolve({ count: 7, error: null });
			},
		};
		const client = { from: (t: string) => (calls.push(["from", t]), builder) } as unknown as SupabaseClient;
		const count = await countFeedbackThisMonth("u1", client, new Date("2026-10-23T05:00:00Z"));
		expect(count).toBe(7);
		expect(calls).toContainEqual(["from", "practice_attempts"]);
		expect(calls).toContainEqual(["eq", "user_id", "u1"]);
		expect(calls).toContainEqual(["not", "feedback", "is", null]);
		expect(calls).toContainEqual(["gte", "created_at", "2026-10-01T00:00:00.000Z"]);
	});

	it("starts the month in UTC", () => {
		expect(startOfMonthUtc(new Date("2026-12-31T23:59:00Z")).toISOString()).toBe("2026-12-01T00:00:00.000Z");
	});
});

describe("toQuestion", () => {
	it("maps a row and defaults the source", () => {
		const q = toQuestion({
			id: "1",
			slug: "s",
			role: "frontend_engineer",
			topic: "react",
			level: "mid",
			stages: ["onsite", 3],
			company_types: null,
			prompt: "p",
			framework_hint: "",
			most_asked: true,
			source_kind: "weird",
			source_note: null,
		});
		expect(q.stages).toEqual(["onsite"]);
		expect(q.companyTypes).toEqual([]);
		expect(q.frameworkHint).toBeNull();
		expect(q.sourceKind).toBe("curated");
		expect(q.sourceNote).toBe("Curated set");
	});
});

describe("Today reads prep interviews", () => {
	it("keeps the soonest interview per company", () => {
		const merged = mergeInterviewSignals([
			[{ companyId: "c1", companyName: "Acme", interviewAt: "2026-10-25T15:00:00Z" }],
			[
				{ companyId: "c1", companyName: "Acme", interviewAt: "2026-10-24T15:00:00Z" },
				{ companyId: "c2", companyName: "Globex", interviewAt: "2026-10-24T10:00:00Z" },
			],
		]);
		expect(merged.map((m) => [m.companyId, m.interviewAt])).toEqual([
			["c2", "2026-10-24T10:00:00Z"],
			["c1", "2026-10-24T15:00:00Z"],
		]);
	});
});

describe("data export", () => {
	it("includes the prep user tables", () => {
		const tables = EXPORT_TABLES.map((t) => t.table);
		expect(tables).toEqual(expect.arrayContaining(["question_reports", "practice_attempts", "interviews"]));
	});
});

describe("seed question set", () => {
	const sql = readFileSync(
		fileURLToPath(new URL("../supabase/migrations/20261024000801_prep_question_seed.sql", import.meta.url)),
		"utf8"
	);
	const rows = sql.split("\n").filter((line) => line.startsWith("  ('"));

	it("has about 80 curated questions with unique slugs across every topic", () => {
		expect(rows.length).toBeGreaterThanOrEqual(80);
		const slugs = rows.map((r) => r.slice(4, r.indexOf("'", 4)));
		expect(new Set(slugs).size).toBe(slugs.length);
		for (const topic of PREP_TOPICS) expect(rows.some((r) => r.includes(`'${topic}'`))).toBe(true);
		expect(sql).toContain("'curated', 'NextMilestone curated set (Oct 2026)'");
		expect(rows.filter((r) => r.includes(" TRUE,")).length).toBeGreaterThan(10);
	});
});
