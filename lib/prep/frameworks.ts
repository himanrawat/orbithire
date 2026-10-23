/** Answer frameworks shown by the optional hint toggle in the practice flow. Pure. */
import type { PrepTopic } from "./constants";

export type Framework = Readonly<{
	id: "star" | "system_design" | "explain";
	name: string;
	steps: readonly Readonly<{ label: string; detail: string }>[];
}>;

export const STAR_FRAMEWORK: Framework = {
	id: "star",
	name: "STAR",
	steps: [
		{ label: "Situation", detail: "One or two sentences of context: team, product, stakes." },
		{ label: "Task", detail: "What you specifically owned or were asked to do." },
		{ label: "Action", detail: "The steps you took. Say \"I\", not \"we\"." },
		{ label: "Result", detail: "The outcome, ideally with a number, and what you learned." },
	],
};

export const SYSTEM_DESIGN_FRAMEWORK: Framework = {
	id: "system_design",
	name: "Requirements → API → data → scale",
	steps: [
		{ label: "Requirements", detail: "Clarify users, core features and what is out of scope." },
		{ label: "API", detail: "Sketch the endpoints or events the client needs." },
		{ label: "Data", detail: "Model client state, caching and how data flows to the UI." },
		{ label: "Scale", detail: "Performance, accessibility, errors, offline and growth." },
	],
};

export const EXPLAIN_FRAMEWORK: Framework = {
	id: "explain",
	name: "Define → example → trade-offs",
	steps: [
		{ label: "Define", detail: "A one-sentence definition in plain words." },
		{ label: "Example", detail: "A short code sketch or a real case where you used it." },
		{ label: "Trade-offs", detail: "When it helps, when it hurts, and what you'd use instead." },
	],
};

const FRAMEWORK_BY_TOPIC: Readonly<Record<PrepTopic, Framework>> = {
	behavioral: STAR_FRAMEWORK,
	leadership: STAR_FRAMEWORK,
	system_design: SYSTEM_DESIGN_FRAMEWORK,
	javascript: EXPLAIN_FRAMEWORK,
	react: EXPLAIN_FRAMEWORK,
	web_fundamentals: EXPLAIN_FRAMEWORK,
};

export function frameworkForTopic(topic: PrepTopic): Framework {
	return FRAMEWORK_BY_TOPIC[topic];
}
