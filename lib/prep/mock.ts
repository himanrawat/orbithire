/**
 * Timed 30-minute mock interview: picks 3-4 questions with a mix of topics and builds the
 * end-of-mock summary. Pure; randomness is injected so tests are deterministic.
 */
import type { PracticeAttempt, PrepQuestion, PrepTopic } from "./constants";

export const MOCK_DURATION_MINUTES = 30;
export const MOCK_MIN_QUESTIONS = 3;
export const MOCK_MAX_QUESTIONS = 4;

/** One slot per group, in interview order: warm-up behavioral, technical, design or leadership. */
const MOCK_SLOTS: readonly (readonly PrepTopic[])[] = [
	["behavioral"],
	["javascript", "react", "web_fundamentals"],
	["system_design", "leadership"],
	["javascript", "react", "web_fundamentals", "behavioral"],
];

function shuffle<T>(items: readonly T[], random: () => number): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

function pickForSlot(
	pool: readonly PrepQuestion[],
	topics: readonly PrepTopic[],
	taken: ReadonlySet<string>
): PrepQuestion | undefined {
	return pool.find((q) => topics.includes(q.topic) && !taken.has(q.id));
}

/**
 * Picks up to `count` questions (clamped to 3-4), most-asked first within each slot.
 * Falls back to any unused question when a slot has no match.
 */
export function pickMockQuestions(
	questions: readonly PrepQuestion[],
	count: number = MOCK_MAX_QUESTIONS,
	random: () => number = Math.random
): PrepQuestion[] {
	const target = Math.min(MOCK_MAX_QUESTIONS, Math.max(MOCK_MIN_QUESTIONS, count));
	const shuffled = shuffle(questions, random);
	const pool = [...shuffled.filter((q) => q.mostAsked), ...shuffled.filter((q) => !q.mostAsked)];
	const taken = new Set<string>();
	const picked: PrepQuestion[] = [];
	for (const topics of MOCK_SLOTS.slice(0, target)) {
		const next = pickForSlot(pool, topics, taken) ?? pool.find((q) => !taken.has(q.id));
		if (!next) break;
		taken.add(next.id);
		picked.push(next);
	}
	return picked;
}

export type MockSummary = Readonly<{
	answered: number;
	total: number;
	strengths: string[];
	gaps: string[];
	nextReads: string[];
}>;

export function summarizeMock(total: number, attempts: readonly PracticeAttempt[]): MockSummary {
	const withFeedback = attempts.filter((a) => a.feedback !== null);
	return {
		answered: attempts.length,
		total,
		strengths: withFeedback.map((a) => a.feedback?.strength ?? ""),
		gaps: withFeedback.map((a) => a.feedback?.gap ?? ""),
		nextReads: withFeedback.map((a) => a.feedback?.nextRead.title ?? ""),
	};
}

/** mm:ss for a countdown; never negative. */
export function formatClock(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(s / 60);
	const seconds = s % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
