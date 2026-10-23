import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown, safeHref } from "@/lib/learn/markdown";
import {
	SKILLS,
	computeSkillGaps,
	detectSkills,
	normalizeForMatch,
	resourcesForSkill,
	userSkillIds,
} from "@/lib/learn/skills";
import {
	checkFetchableUrl,
	decodeEntities,
	extractTitle,
	fallbackTitle,
	isPrivateAddress,
} from "@/lib/learn/urlSafety";
import { buildEntryInsert, buildEntryUpdate, buildProgressRow, needsTitleFetch } from "@/lib/learn/entries";
import { createEntrySchema, progressSchema, updateEntrySchema } from "@/lib/learn/schema";
import { libraryHref, lessonHref, normalizeTags } from "@/lib/learn/types";
import { parseLearnTab } from "@/lib/learn/tabs";

const USER = "00000000-0000-4000-8000-000000000001";
const LONG = "a".repeat(200_000);

describe("isPrivateAddress", () => {
	it.each([
		"127.0.0.1",
		"10.1.2.3",
		"172.16.0.1",
		"172.31.255.255",
		"192.168.1.1",
		"169.254.169.254",
		"100.64.0.1",
		"0.0.0.0",
		"224.0.0.1",
		"::1",
		"::",
		"fc00::1",
		"fd12::1",
		"fe80::1",
		"::ffff:127.0.0.1",
		"::ffff:10.0.0.1",
		"not-an-ip",
	])("blocks %s", (ip) => {
		expect(isPrivateAddress(ip)).toBe(true);
	});

	it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => {
		expect(isPrivateAddress(ip)).toBe(false);
	});
});

describe("checkFetchableUrl", () => {
	it("allows public http and https URLs", () => {
		expect(checkFetchableUrl("https://developer.mozilla.org/en-US/").ok).toBe(true);
		expect(checkFetchableUrl("http://example.com:80/a").ok).toBe(true);
	});

	it.each([
		"ftp://example.com/file",
		"file:///etc/passwd",
		"javascript:alert(1)",
		"http://localhost:3000/",
		"http://app.localhost/",
		"http://127.0.0.1/",
		"http://[::1]/",
		"http://169.254.169.254/latest/meta-data/",
		"http://10.0.0.5/",
		"https://user:pass@example.com/",
		"https://example.com:8443/",
		"http://intranet/",
		"http://printer.local/",
		"not a url",
	])("rejects %s", (url) => {
		expect(checkFetchableUrl(url).ok).toBe(false);
	});
});

describe("extractTitle", () => {
	it("reads and decodes the first title", () => {
		expect(extractTitle("<html><head><title>  Hello &amp; welcome\n to MDN </title></head>")).toBe("Hello & welcome to MDN");
		expect(extractTitle('<TITLE data-x="1">Caps &#8211; ok</TITLE>')).toBe("Caps – ok");
	});

	it("ignores look-alike tags and missing titles", () => {
		expect(extractTitle("<titles>no</titles>")).toBeNull();
		expect(extractTitle("<html><head></head></html>")).toBeNull();
		expect(extractTitle("<title></title>")).toBeNull();
	});

	it("caps the length", () => {
		expect(extractTitle(`<title>${"x".repeat(500)}</title>`)?.length).toBe(300);
	});

	it("handles long non-matching input quickly", () => {
		const start = Date.now();
		expect(extractTitle(`<title${LONG}`)).toBeNull();
		expect(extractTitle("<title ".repeat(20_000))).toBeNull();
		expect(decodeEntities("&".repeat(100_000))).toHaveLength(100_000);
		expect(Date.now() - start).toBeLessThan(1000);
	});
});

describe("fallbackTitle", () => {
	it("uses host and first path segment", () => {
		expect(fallbackTitle("https://www.example.com/guides/intro")).toBe("example.com/guides");
		expect(fallbackTitle("https://web.dev/")).toBe("web.dev");
	});
});

describe("markdown", () => {
	it("parses headings, lists, code and paragraphs", () => {
		const blocks = parseMarkdown("## Title\n\nSome *em* and **bold**.\nSame paragraph.\n\n- one\n- two\n\n1. first\n2. second\n\n```js\nconst a = 1;\n```\n\n> quote");
		expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "list", "list", "code", "quote"]);
		expect(blocks[0]).toMatchObject({ type: "heading", level: 2 });
		expect(blocks[2]).toMatchObject({ ordered: false });
		expect(blocks[3]).toMatchObject({ ordered: true });
		expect(blocks[4]).toEqual({ type: "code", text: "const a = 1;" });
	});

	it("maps ### to h3", () => {
		expect(parseMarkdown("### Small")[0]).toMatchObject({ type: "heading", level: 3 });
	});

	it("keeps only safe links", () => {
		expect(parseInline("[MDN](https://developer.mozilla.org)")).toEqual([
			{ type: "link", href: "https://developer.mozilla.org/", children: [{ type: "text", text: "MDN" }] },
		]);
		expect(parseInline("[x](javascript:alert(1))").some((node) => node.type === "link")).toBe(false);
		expect(parseInline("[x](javascript:void)")).toEqual([{ type: "text", text: "x" }]);
		expect(safeHref("//evil.com")).toBeNull();
		expect(safeHref("/learn")).toBe("/learn");
		expect(safeHref("data:text/html,hi")).toBeNull();
	});

	it("keeps snake_case and arithmetic literal", () => {
		expect(parseInline("snake_case_name and 2 * 3 * 4")).toEqual([{ type: "text", text: "snake_case_name and 2 * 3 * 4" }]);
		expect(parseInline("`a_b` text")[0]).toEqual({ type: "code", text: "a_b" });
	});

	it("never produces raw HTML", () => {
		const blocks = parseMarkdown("<script>alert(1)</script>");
		expect(blocks).toEqual([{ type: "paragraph", children: [{ type: "text", text: "<script>alert(1)</script>" }] }]);
	});
});

describe("skills", () => {
	it("detects skills by whole token and phrase", () => {
		const text = "We use React, TypeScript and Next.js. Experience with system design and GraphQL; Node.js a plus.";
		expect(detectSkills(text)).toEqual(expect.arrayContaining(["react", "typescript", "nextjs", "system-design", "graphql", "nodejs"]));
		expect(detectSkills("Java and Spring Boot")).toEqual(["java"]);
		expect(detectSkills("JavaScript only")).toEqual(["javascript"]);
	});

	it("avoids common false positives", () => {
		expect(detectSkills("the rest of the team, see https://example.com in spring")).toEqual([]);
		expect(detectSkills("reactive")).toEqual([]);
	});

	it("keeps .NET and C#", () => {
		expect(detectSkills("C# and .NET services")).toEqual(["csharp"]);
	});

	it("normalizes punctuation", () => {
		expect(normalizeForMatch("React.")).toBe(" react ");
	});

	it("has unique ids", () => {
		expect(new Set(SKILLS.map((skill) => skill.id)).size).toBe(SKILLS.length);
	});

	it("handles long non-matching input quickly", () => {
		const start = Date.now();
		expect(detectSkills(LONG)).toEqual([]);
		expect(detectSkills("!@$%^&*()".repeat(20_000))).toEqual([]);
		expect(Date.now() - start).toBeLessThan(1000);
	});

	it("reads profile skills and resume text", () => {
		const ids = userSkillIds(["ReactJS", "Postgres"], "Built APIs in Python and Docker");
		expect([...ids].sort()).toEqual(["docker", "python", "react", "sql"]);
	});
});

describe("computeSkillGaps", () => {
	const lessons = [
		{ slug: "react-questions", title: "React questions", body_md: "Rendering and keys", pathSlug: "frontend-interview" },
		{ slug: "a-framework", title: "A framework for frontend system design", body_md: "", pathSlug: "frontend-system-design" },
	];
	const library = [
		{ kind: "link" as const, slug: "owasp", url: "https://owasp.org/", title: "OWASP Top Ten", tags: ["security"] },
		{ kind: "guide" as const, slug: "ts-guide", url: null, title: "TypeScript tips", tags: [] },
	];

	it("ranks missing skills by how many matches ask for them and links resources", () => {
		const gaps = computeSkillGaps({
			jobTexts: [
				"React, TypeScript, system design",
				"React and TypeScript, web security",
				"React with GraphQL",
			],
			profileSkills: ["React"],
			resumeText: "",
			lessons,
			library,
		});
		expect(gaps.map((gap) => [gap.skillId, gap.jobCount])).toEqual([
			["typescript", 2],
			["graphql", 1],
			["security", 1],
			["system-design", 1],
		]);
		expect(gaps[0].resources).toEqual([{ kind: "library", title: "TypeScript tips", href: "/learn/library/ts-guide", external: false }]);
		expect(gaps[2].resources[0]).toMatchObject({ href: "https://owasp.org/", external: true });
		expect(gaps[3].resources[0]).toMatchObject({ kind: "lesson", href: "/learn/paths/frontend-system-design/a-framework" });
	});

	it("caps at the limit and returns nothing when the profile covers it", () => {
		const text = "javascript typescript html css react vue angular graphql";
		expect(computeSkillGaps({ jobTexts: [text], profileSkills: [], resumeText: "", lessons, library })).toHaveLength(5);
		expect(
			computeSkillGaps({ jobTexts: ["React"], profileSkills: [], resumeText: "Five years of React", lessons, library })
		).toEqual([]);
	});

	it("counts each job once per skill", () => {
		const gaps = computeSkillGaps({ jobTexts: ["React react REACT reactjs"], profileSkills: [], resumeText: "", lessons, library });
		expect(gaps).toEqual([expect.objectContaining({ skillId: "react", jobCount: 1 })]);
	});

	it("returns no resources for unknown skills", () => {
		expect(resourcesForSkill("nope", lessons, library)).toEqual([]);
	});
});

describe("entries", () => {
	it("validates link and note bodies", () => {
		expect(createEntrySchema.safeParse({ kind: "link", url: "https://web.dev/learn/css" }).success).toBe(true);
		expect(createEntrySchema.safeParse({ kind: "link", url: "javascript:alert(1)" }).success).toBe(false);
		expect(createEntrySchema.safeParse({ kind: "link", url: "ftp://example.com" }).success).toBe(false);
		expect(createEntrySchema.safeParse({ kind: "note", note: "" }).success).toBe(false);
		expect(createEntrySchema.safeParse({ kind: "note", note: "x", extra: 1 }).success).toBe(false);
		expect(createEntrySchema.safeParse({ kind: "note", note: "x", tags: Array(11).fill("t") }).success).toBe(false);
	});

	it("builds private inserts with fetched or fallback titles", () => {
		const link = createEntrySchema.parse({ kind: "link", url: "https://web.dev/learn/css", tags: [" CSS ", "css", "Layout"] });
		expect(needsTitleFetch(link)).toBe(true);
		expect(buildEntryInsert(USER, link, "Learn CSS")).toMatchObject({
			kind: "link",
			title: "Learn CSS",
			tags: ["css", "layout"],
			visibility: "private",
			note: null,
		});
		expect(buildEntryInsert(USER, link, null).title).toBe("web.dev/learn");
		const note = createEntrySchema.parse({ kind: "note", note: "Closures keep scope" });
		expect(needsTitleFetch(note)).toBe(false);
		expect(buildEntryInsert(USER, note, null)).toMatchObject({ kind: "note", url: null, note: "Closures keep scope", visibility: "private" });
	});

	it("builds partial updates", () => {
		expect(buildEntryUpdate(updateEntrySchema.parse({ visibility: "public" }))).toEqual({ visibility: "public" });
		expect(buildEntryUpdate(updateEntrySchema.parse({ title: "", tags: ["A"] }))).toEqual({ title: null, tags: ["a"] });
		expect(updateEntrySchema.safeParse({}).success).toBe(false);
		expect(updateEntrySchema.safeParse({ visibility: "friends" }).success).toBe(false);
	});

	it("builds progress rows", () => {
		const now = new Date("2026-10-23T12:00:00Z");
		expect(buildProgressRow(USER, "l1", "done", now).completed_at).toBe("2026-10-23T12:00:00.000Z");
		expect(buildProgressRow(USER, "l1", "in_progress", now).completed_at).toBeNull();
		expect(progressSchema.safeParse({ lessonId: "not-a-uuid", status: "done" }).success).toBe(false);
	});
});

describe("helpers", () => {
	it("normalizes tags", () => {
		expect(normalizeTags(["  Web   Perf ", "web perf", "", "x".repeat(60)])).toEqual(["web perf", "x".repeat(40)]);
	});

	it("builds hrefs", () => {
		expect(lessonHref("web-foundations", "semantic-html")).toBe("/learn/paths/web-foundations/semantic-html");
		expect(libraryHref({ kind: "link", slug: "x", url: "https://a.dev/" })).toBe("https://a.dev/");
		expect(libraryHref({ kind: "guide", slug: "g", url: null })).toBe("/learn/library/g");
	});

	it("parses the tab param", () => {
		expect(parseLearnTab("paths")).toBe("paths");
		expect(parseLearnTab(["library"])).toBe("library");
		expect(parseLearnTab("nope")).toBe("log");
		expect(parseLearnTab(undefined)).toBe("log");
	});
});

describe("seed migration", () => {
	const sql = readFileSync("supabase/migrations/20261024000601_learn_seed_paths.sql", "utf8");
	const rows = [...sql.matchAll(/^\('([a-z-]+)', '([a-z0-9-]+)', '[^']*', (\d+), \$md\$/gm)];

	it("seeds 4 paths with 5–8 lessons of 8–15 minutes", () => {
		const byPath = new Map<string, number>();
		for (const [, path, , minutes] of rows) {
			byPath.set(path, (byPath.get(path) ?? 0) + 1);
			expect(Number(minutes)).toBeGreaterThanOrEqual(8);
			expect(Number(minutes)).toBeLessThanOrEqual(15);
		}
		expect([...byPath.keys()].sort()).toEqual(["frontend-interview", "frontend-system-design", "senior-to-lead", "web-foundations"]);
		for (const count of byPath.values()) {
			expect(count).toBeGreaterThanOrEqual(5);
			expect(count).toBeLessThanOrEqual(8);
		}
	});

	it("only links to http(s) in lesson bodies", () => {
		const bodies = sql.split("$md$").filter((_, index) => index % 2 === 1);
		expect(bodies.length).toBe(rows.length);
		for (const body of bodies) {
			for (const block of parseMarkdown(body)) {
				expect(block.type).not.toBe("html");
			}
			expect(body).toContain("## Further reading");
		}
	});
});
