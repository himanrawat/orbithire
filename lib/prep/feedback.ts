/**
 * AI feedback for a practice answer: exactly one strength, one gap and one next read,
 * as strict JSON validated with Zod. Pure prompt building and parsing; the provider call
 * lives in lib/prep/ai.ts. Bump PROMPT_VERSIONS.prep_feedback when this prompt changes.
 */
import type { PrepFeedback, PrepQuestion } from "./constants";
import { TOPIC_LABELS, LEVEL_LABELS } from "./constants";
import { frameworkForTopic } from "./frameworks";
import { feedbackSchema } from "./schema";

export const FEEDBACK_SYSTEM_PROMPT = `You are a kind, specific interview coach helping someone practice BEFORE an interview.
Review their practice answer and reply with JSON only, no prose, in exactly this shape:
{"strength": string, "gap": string, "nextRead": {"title": string, "detail": string}}

Rules:
- strength: ONE concrete thing the answer does well, quoting or paraphrasing it. Max 2 sentences.
- gap: ONE most important thing to improve, phrased as a specific, doable change. Max 2 sentences.
- nextRead: ONE topic or resource to study next. title is short (under 12 words); detail says why, in one sentence.
- Be encouraging and plain-spoken. Never harsh, never sarcastic, no scores.
- Judge only the answer given. Do not invent facts about the person.
- Use US English.`;

const MAX_ANSWER_CHARS = 8000;

export function buildFeedbackPrompt(question: PrepQuestion, answer: string): string {
	const framework = frameworkForTopic(question.topic);
	const steps = framework.steps.map((s) => s.label).join(" → ");
	return [
		`Question (${TOPIC_LABELS[question.topic]}, ${LEVEL_LABELS[question.level]} level):`,
		question.prompt,
		"",
		`A good answer usually follows: ${framework.name} (${steps}).`,
		question.frameworkHint ? `Hint for this question: ${question.frameworkHint}` : "",
		"",
		"Practice answer:",
		answer.slice(0, MAX_ANSWER_CHARS),
	]
		.filter((line, i, all) => line !== "" || all[i - 1] !== "")
		.join("\n");
}

/** Returns the substring from the first "{" to the last "}", or null. Linear, no regex. */
function extractJsonObject(content: string): string | null {
	const start = content.indexOf("{");
	const end = content.lastIndexOf("}");
	if (start === -1 || end <= start) return null;
	return content.slice(start, end + 1);
}

/** Parses the model output; null when it is not exactly the expected shape. */
export function parseFeedback(content: string): PrepFeedback | null {
	const json = extractJsonObject(content);
	if (!json) return null;
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		return null;
	}
	const parsed = feedbackSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}
