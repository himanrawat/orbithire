/**
 * Match imported PDF filenames (ai-job-search `cv/main_<company>_<role>.pdf`,
 * `cover_letters/cover_<company>_<role>.pdf`) to existing applications.
 *
 * Mirrored in worker/orbithire_worker/import_legacy.py (match_filename).
 */
import type { DocumentType } from "@/lib/types/database";

export type MatchConfidence = "tracker" | "exact" | "role" | "company" | "none";

export interface MatchCompany {
	id: string;
	name: string;
	job_title: string | null;
	notes?: string | null;
}

export interface FilenameMatch {
	filename: string;
	kind: DocumentType;
	slug: string;
	companyId: string | null;
	companyLabel: string | null;
	confidence: MatchConfidence;
	/** Suggested document title. */
	title: string;
	/** True for template/sample files such as main_example.pdf. */
	suggestSkip: boolean;
}

const RESUME_PREFIXES = ["main_", "cv_", "resume_"];
const COVER_PREFIXES = ["cover_letter_", "cover_", "cl_"];

export const basename = (p: string) => p.split(/[\\/]/).pop() || p;
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const tokens = (s: string) =>
	s
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

function jaccard(a: string[], b: string[]): number {
	if (!a.length || !b.length) return 0;
	const A = new Set(a);
	const B = new Set(b);
	let inter = 0;
	A.forEach((t) => {
		if (B.has(t)) inter++;
	});
	return inter / (A.size + B.size - inter);
}

export function parsePdfFilename(filename: string): { kind: DocumentType; slug: string } {
	const base = basename(filename).replace(/\.pdf$/i, "");
	const lower = base.toLowerCase();
	for (const p of COVER_PREFIXES) if (lower.startsWith(p)) return { kind: "cover_letter", slug: lower.slice(p.length) };
	for (const p of RESUME_PREFIXES) if (lower.startsWith(p)) return { kind: "resume", slug: lower.slice(p.length) };
	return { kind: lower.includes("cover") ? "cover_letter" : "resume", slug: lower };
}

const titleCase = (s: string) =>
	tokens(s)
		.map((t) => t.charAt(0).toUpperCase() + t.slice(1))
		.join(" ");

/** Tokens of the slug after the leading company part, or null if the slug doesn't start with the company. */
function roleTokensAfterCompany(slug: string, companyName: string): string[] | null {
	const cn = compact(companyName);
	if (cn.length < 2) return null;
	const toks = tokens(slug);
	let acc = "";
	for (let i = 0; i < toks.length; i++) {
		acc += toks[i];
		if (acc === cn) return toks.slice(i + 1);
		if (!cn.startsWith(acc)) return null;
	}
	return null;
}

function trackerReferences(notes: string | null | undefined, filename: string): boolean {
	if (!notes) return false;
	const base = basename(filename).toLowerCase();
	return notes
		.split("\n")
		.some((l) => /^(cv file|cover letter file):/i.test(l.trim()) && basename(l.split(":").slice(1).join(":").trim()).toLowerCase() === base);
}

const RANK: Record<MatchConfidence, number> = { tracker: 4, exact: 3, role: 2, company: 1, none: 0 };

export function matchPdfFilename(filename: string, companies: MatchCompany[]): FilenameMatch {
	const { kind, slug } = parsePdfFilename(filename);
	const kindLabel = kind === "resume" ? "CV" : "Cover letter";
	let best: { c: MatchCompany; conf: MatchConfidence; score: number } | null = null;
	for (const c of companies) {
		let conf: MatchConfidence = "none";
		let score = 0;
		if (trackerReferences(c.notes, filename)) {
			conf = "tracker";
			score = 1;
		} else {
			const role = roleTokensAfterCompany(slug, c.name);
			if (role === null) continue;
			const titleToks = tokens(c.job_title || "");
			score = jaccard(role, titleToks);
			if (titleToks.length && compact(role.join("")) === compact(c.job_title || "")) conf = "exact";
			else if (score >= 0.5) conf = "role";
			else conf = "company";
		}
		if (!best || RANK[conf] > RANK[best.conf] || (RANK[conf] === RANK[best.conf] && score > best.score)) {
			best = { c, conf, score };
		}
	}
	const suggestSkip = tokens(slug).includes("example") || tokens(slug).includes("template");
	if (!best) {
		return {
			filename: basename(filename),
			kind,
			slug,
			companyId: null,
			companyLabel: null,
			confidence: "none",
			title: `${kindLabel} – ${titleCase(slug) || basename(filename)} (imported)`,
			suggestSkip,
		};
	}
	const label = best.c.job_title ? `${best.c.name} – ${best.c.job_title}` : best.c.name;
	return {
		filename: basename(filename),
		kind,
		slug,
		companyId: best.c.id,
		companyLabel: label,
		confidence: best.conf,
		title: `${kindLabel} – ${label} (imported)`,
		suggestSkip,
	};
}

/** Deterministic R2 key per user + kind + file, so re-importing the same file is detected. */
export function importFileKey(userId: string, kind: DocumentType, filename: string): string {
	const stem = basename(filename)
		.replace(/\.pdf$/i, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 80);
	return `${userId}/${kind === "resume" ? "resumes" : "cover-letters"}/import-${stem || "file"}.pdf`;
}
