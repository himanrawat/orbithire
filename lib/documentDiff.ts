/**
 * Section-level diff between two document contents (JSON Resume or cover letter
 * content_json), for the version history panel. Deliberately simple: which
 * sections changed, plus added / removed lines for text and list sections.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SectionDiff {
	section: string;
	status: "added" | "removed" | "changed";
	added: string[];
	removed: string[];
}

const NESTED = new Set(["basics", "recipient", "meta"]);
const LABELS: Record<string, string> = {
	"basics.name": "Name",
	"basics.label": "Headline",
	"basics.summary": "Summary",
	"basics.location": "Location",
	work: "Experience",
	education: "Education",
	skills: "Skills",
	projects: "Projects",
	paragraphs: "Body",
	content: "Body",
	salutation: "Salutation",
	closing: "Closing",
	meta: "Template options",
};

const isEmpty = (v: unknown) =>
	v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/** One display line per meaningful piece of a value. */
export function toLines(v: unknown): string[] {
	if (isEmpty(v)) return [];
	if (typeof v === "string") return v.split(/\n+/).map((l) => l.trim()).filter(Boolean);
	if (typeof v === "number" || typeof v === "boolean") return [String(v)];
	if (Array.isArray(v)) return v.flatMap((item) => (typeof item === "object" && item ? [entryLabel(item), ...entryDetails(item)] : toLines(item)));
	return Object.entries(v as Record<string, unknown>)
		.filter(([, x]) => !isEmpty(x))
		.map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`);
}

function entryLabel(o: any): string {
	const head = [o.position || o.studyType || o.name || o.title, o.name && o.position ? o.name : o.institution || o.area]
		.filter(Boolean)
		.join(" · ");
	const dates = [o.startDate, o.endDate].filter(Boolean).join(" – ");
	return `${head || "(entry)"}${dates ? ` (${dates})` : ""}`;
}

function entryDetails(o: any): string[] {
	const out: string[] = [];
	for (const k of ["summary", "description"]) if (typeof o[k] === "string" && o[k]) out.push(`  ${o[k]}`);
	for (const k of ["highlights", "keywords", "courses"]) if (Array.isArray(o[k])) out.push(...o[k].map((h: unknown) => `  • ${h}`));
	return out;
}

function sections(content: any): Map<string, unknown> {
	const map = new Map<string, unknown>();
	if (!content || typeof content !== "object") return map;
	for (const [k, v] of Object.entries(content)) {
		if (NESTED.has(k) && v && typeof v === "object" && !Array.isArray(v)) {
			for (const [k2, v2] of Object.entries(v as object)) map.set(`${k}.${k2}`, v2);
		} else {
			map.set(k, v);
		}
	}
	return map;
}

export const sectionLabel = (key: string) =>
	LABELS[key] ?? key.replace(/^(basics|recipient|meta)\./, (_, p) => (p === "recipient" ? "Recipient " : "")).replace(/_/g, " ");

/** Diff `from` (older) -> `to` (newer). */
export function diffDocuments(from: unknown, to: unknown): SectionDiff[] {
	const a = sections(from);
	const b = sections(to);
	const keys = Array.from(new Set([...Array.from(a.keys()), ...Array.from(b.keys())]));
	const out: SectionDiff[] = [];
	for (const key of keys) {
		const va = a.get(key);
		const vb = b.get(key);
		if (JSON.stringify(va ?? null) === JSON.stringify(vb ?? null)) continue;
		if (isEmpty(va) && isEmpty(vb)) continue;
		const la = toLines(va);
		const lb = toLines(vb);
		const setA = new Set(la);
		const setB = new Set(lb);
		out.push({
			section: sectionLabel(key),
			status: isEmpty(va) ? "added" : isEmpty(vb) ? "removed" : "changed",
			added: lb.filter((l) => !setA.has(l)),
			removed: la.filter((l) => !setB.has(l)),
		});
	}
	return out;
}
