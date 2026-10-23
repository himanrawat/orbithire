/**
 * The curated skill list behind the skill-gap card, and the pure helpers that derive gaps:
 * skills the user's top job matches mention, minus the skills on their profile and master
 * resume, each linked to matching lessons and library items. No server imports.
 *
 * Matching is token based (no per-skill regexes): text is lowercased, split on anything that
 * isn't a letter, digit, "+", "#" or ".", and aliases are looked up as whole tokens or phrases.
 */
import { lessonHref, libraryHref, type LibraryItem, type ResourceLink, type SkillGap } from "./types";

export type Skill = Readonly<{
	id: string;
	label: string;
	/** lowercase whole-word forms, including the label's own form */
	aliases: readonly string[];
}>;

export const SKILLS: readonly Skill[] = [
	{ id: "javascript", label: "JavaScript", aliases: ["javascript", "js", "es6", "ecmascript"] },
	{ id: "typescript", label: "TypeScript", aliases: ["typescript", "ts"] },
	{ id: "html", label: "HTML", aliases: ["html", "html5", "semantic html"] },
	{ id: "css", label: "CSS", aliases: ["css", "css3", "flexbox", "css grid", "sass", "scss"] },
	{ id: "react", label: "React", aliases: ["react", "react.js", "reactjs"] },
	{ id: "nextjs", label: "Next.js", aliases: ["next.js", "nextjs"] },
	{ id: "vue", label: "Vue", aliases: ["vue", "vue.js", "vuejs", "nuxt"] },
	{ id: "angular", label: "Angular", aliases: ["angular"] },
	{ id: "svelte", label: "Svelte", aliases: ["svelte", "sveltekit"] },
	{ id: "nodejs", label: "Node.js", aliases: ["node.js", "nodejs", "node"] },
	{ id: "accessibility", label: "Accessibility", aliases: ["accessibility", "a11y", "wcag", "aria"] },
	{ id: "performance", label: "Web performance", aliases: ["web performance", "core web vitals", "lighthouse", "performance optimization"] },
	{ id: "testing", label: "Testing", aliases: ["unit testing", "jest", "vitest", "testing library", "cypress", "playwright", "tdd"] },
	{ id: "graphql", label: "GraphQL", aliases: ["graphql", "apollo"] },
	{ id: "rest", label: "REST APIs", aliases: ["restful", "rest api", "rest apis", "api design"] },
	{ id: "http", label: "HTTP and networking", aliases: ["http/2", "http/3", "networking", "cdn", "cdns", "http caching", "caching"] },
	{ id: "security", label: "Web security", aliases: ["web security", "owasp", "xss", "csrf", "content security policy"] },
	{ id: "state-management", label: "State management", aliases: ["redux", "zustand", "mobx", "state management", "react query", "tanstack query"] },
	{ id: "system-design", label: "System design", aliases: ["system design", "systems design", "architecture", "distributed systems", "scalability"] },
	{ id: "design-systems", label: "Design systems", aliases: ["design system", "design systems", "component library", "storybook"] },
	{ id: "git", label: "Git", aliases: ["git", "github", "gitlab", "version control"] },
	{ id: "ci-cd", label: "CI/CD", aliases: ["ci/cd", "continuous integration", "github actions", "jenkins", "circleci"] },
	{ id: "docker", label: "Docker", aliases: ["docker", "containers", "containerization"] },
	{ id: "kubernetes", label: "Kubernetes", aliases: ["kubernetes", "k8s"] },
	{ id: "aws", label: "AWS", aliases: ["aws", "amazon web services", "lambda", "s3", "ec2"] },
	{ id: "gcp", label: "Google Cloud", aliases: ["gcp", "google cloud"] },
	{ id: "azure", label: "Azure", aliases: ["azure"] },
	{ id: "sql", label: "SQL", aliases: ["sql", "postgres", "postgresql", "mysql", "sqlite"] },
	{ id: "nosql", label: "NoSQL", aliases: ["nosql", "mongodb", "dynamodb", "redis", "cassandra"] },
	{ id: "python", label: "Python", aliases: ["python", "django", "flask", "fastapi"] },
	{ id: "java", label: "Java", aliases: ["java", "spring boot", "jvm"] },
	{ id: "go", label: "Go", aliases: ["golang"] },
	{ id: "rust", label: "Rust", aliases: ["rust"] },
	{ id: "csharp", label: "C#", aliases: ["c#", ".net", "dotnet", "asp.net"] },
	{ id: "data-structures", label: "Data structures and algorithms", aliases: ["data structures", "algorithms", "big o", "leetcode"] },
	{ id: "machine-learning", label: "Machine learning", aliases: ["machine learning", "ml", "pytorch", "tensorflow", "llm", "llms"] },
	{ id: "observability", label: "Observability", aliases: ["observability", "monitoring", "datadog", "sentry", "opentelemetry", "grafana"] },
	{ id: "mentoring", label: "Mentoring", aliases: ["mentoring", "mentorship", "coaching"] },
	{ id: "technical-leadership", label: "Technical leadership", aliases: ["technical leadership", "tech lead", "lead engineer", "leadership"] },
	{ id: "communication", label: "Written communication", aliases: ["communication skills", "written communication", "technical writing", "design docs", "rfcs"] },
	{ id: "agile", label: "Agile delivery", aliases: ["agile", "scrum", "kanban"] },
	{ id: "product-sense", label: "Product sense", aliases: ["product sense", "product thinking", "product mindset"] },
];

const SKILL_BY_ID = new Map(SKILLS.map((skill) => [skill.id, skill]));

/** Lowercased tokens joined by single spaces and padded, ready for phrase lookups. */
export function normalizeForMatch(text: string): string {
	const tokens = text
		.toLowerCase()
		.split(/[^a-z0-9+#./]+/)
		.map((token) => trimDots(token))
		.filter(Boolean);
	return ` ${tokens.join(" ")} `;
}

function trimDots(token: string) {
	let start = 0;
	let end = token.length;
	while (start < end && (token[start] === "." || token[start] === "/")) start++;
	while (end > start && (token[end - 1] === "." || token[end - 1] === "/")) end--;
	// keep a leading dot for ".net"
	if (start === 1 && token.slice(1, end) === "net") start = 0;
	return token.slice(start, end);
}

function mentions(normalized: string, skill: Skill) {
	return skill.aliases.some((alias) => normalized.includes(` ${alias} `));
}

/** Skill ids mentioned in free text, in SKILLS order. */
export function detectSkills(text: string): string[] {
	if (!text) return [];
	const normalized = normalizeForMatch(text);
	return SKILLS.filter((skill) => mentions(normalized, skill)).map((skill) => skill.id);
}

/** Skill ids the person already has: profile skill strings plus skills named in their resume text. */
export function userSkillIds(profileSkills: readonly string[], resumeText: string): Set<string> {
	const ids = new Set<string>(detectSkills(resumeText));
	for (const skill of profileSkills) {
		for (const id of detectSkills(skill)) ids.add(id);
	}
	return ids;
}

export type LessonRef = Readonly<{ title: string; body_md: string; slug: string; pathSlug: string }>;

/** Up to `limit` lessons and library items whose text or tags cover the skill. Lessons first. */
export function resourcesForSkill(
	skillId: string,
	lessons: readonly LessonRef[],
	library: readonly Pick<LibraryItem, "kind" | "slug" | "url" | "title" | "tags">[],
	limit = 3
): ResourceLink[] {
	const skill = SKILL_BY_ID.get(skillId);
	if (!skill) return [];
	const out: ResourceLink[] = [];
	for (const lesson of lessons) {
		if (out.length >= limit) return out;
		if (mentions(normalizeForMatch(`${lesson.title} ${lesson.body_md}`), skill)) {
			out.push({ kind: "lesson", title: lesson.title, href: lessonHref(lesson.pathSlug, lesson.slug), external: false });
		}
	}
	for (const item of library) {
		if (out.length >= limit) return out;
		if (item.tags.includes(skillId) || mentions(normalizeForMatch(item.title), skill)) {
			const href = libraryHref(item);
			out.push({ kind: "library", title: item.title, href, external: !href.startsWith("/") });
		}
	}
	return out;
}

export type GapInput = Readonly<{
	jobTexts: readonly string[];
	profileSkills: readonly string[];
	resumeText: string;
	lessons: readonly LessonRef[];
	library: readonly Pick<LibraryItem, "kind" | "slug" | "url" | "title" | "tags">[];
	limit?: number;
}>;

/**
 * Skills the job texts ask for that the person doesn't list, most-requested first (ties by
 * SKILLS order), capped at `limit` (default 5), each with matching resources.
 */
export function computeSkillGaps(input: GapInput): SkillGap[] {
	const have = userSkillIds(input.profileSkills, input.resumeText);
	const counts = new Map<string, number>();
	for (const text of input.jobTexts) {
		for (const id of detectSkills(text)) {
			if (!have.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
		}
	}
	const order = new Map(SKILLS.map((skill, index) => [skill.id, index]));
	return [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
		.slice(0, input.limit ?? 5)
		.map(([skillId, jobCount]) => ({
			skillId,
			label: SKILL_BY_ID.get(skillId)?.label ?? skillId,
			jobCount,
			resources: resourcesForSkill(skillId, input.lessons, input.library),
		}));
}
