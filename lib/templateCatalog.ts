/**
 * Template catalog shared by server and client code (no server imports).
 *
 * Two engines live side by side until Phase 7:
 *  - "typst": templates/typst/<id>/ (meta.json + thumbnail.png), rendered by the worker
 *  - "html":  the legacy JSON Resume themes rendered by /api/resume/render + Puppeteer,
 *             shown as "Classic (HTML)" in the UI
 *
 * Some ids exist in both engines ("modern", "compact"), so UI selections use a
 * key of the form "<engine>:<id>". The database stores `template = id` and
 * `engine` separately.
 */
import type { DocumentEngine } from "@/lib/types/database";

export type TemplateKind = "resume" | "cover_letter";

export interface TemplateInfo {
	/** "<engine>:<id>" – unique across engines */
	key: string;
	id: string;
	engine: DocumentEngine;
	kind: TemplateKind;
	name: string;
	/** Short label shown on the card ("Typst", "Classic (HTML)") */
	engineLabel: string;
	style: string;
	description: string;
	tags: string[];
	thumbnailUrl: string;
	photo: boolean;
	onePage: boolean;
	accentDefault: string | null;
	accentCustomizable: boolean;
	paperDefault: "a4" | "letter";
	/** Typst only: the cover letter template matching this resume template */
	pairsWith?: string | null;
}

export const HTML_ENGINE_LABEL = "Classic (HTML)";
export const TYPST_ENGINE_LABEL = "Typst";

function html(
	id: string,
	name: string,
	style: string,
	description: string,
	tags: string[]
): TemplateInfo {
	return {
		key: `html:${id}`,
		id,
		engine: "html",
		kind: "resume",
		name,
		engineLabel: HTML_ENGINE_LABEL,
		style,
		description,
		tags,
		thumbnailUrl: `/api/template/thumbnail/${id}`,
		photo: false,
		onePage: false,
		accentDefault: null,
		accentCustomizable: false,
		paperDefault: "letter",
		pairsWith: null,
	};
}

export const HTML_TEMPLATES: TemplateInfo[] = [
	html("standard", "Standard", "Classic", "The official reference theme - clean, professional, and widely recognized", ["Official", "ATS-Friendly", "Classic"]),
	html("professional", "Professional", "Executive", "Modern and elegant design with great typography for senior roles", ["Executive", "Corporate", "Premium"]),
	html("even", "Even", "Modern Flat", "Clean, flat design with excellent readability and modern aesthetics", ["Modern", "ATS-Friendly", "Popular"]),
	html("elegant", "Elegant", "Minimalist", "Detailed, professional layout with comprehensive sections", ["Corporate", "Detailed", "Executive"]),
	html("flat", "Flat", "Contemporary", "Contemporary flat design with clean lines and bold sections", ["Modern", "Clean", "Tech"]),
	html("spartacus", "Spartacus", "Bold", "Bold and impactful layout with strong visual hierarchy", ["Bold", "Visual", "Standout"]),
	html("paper", "Paper", "Minimal", "Minimal paper-like design focused purely on content", ["Minimal", "Print-Ready", "Clean"]),
	html("compact", "Compact", "ATS-Optimized", "Single column, keyword-dense format optimized for ATS systems", ["ATS-Friendly", "1 Page", "US Format"]),
	html("modern", "Modern", "Two-Column", "Sleek sidebar layout with skills and contact prominently displayed", ["Visual", "Tech", "Startups"]),
];

export const DEFAULT_TYPST_RESUME = "modern";
export const DEFAULT_TYPST_COVER = "cover-modern";

export function templateKey(engine: DocumentEngine, id: string): string {
	return `${engine}:${id}`;
}

/** "typst:modern" -> {engine:"typst", id:"modern"}; bare ids are treated as legacy HTML. */
export function parseTemplateKey(key: string): { engine: DocumentEngine; id: string } {
	const idx = key.indexOf(":");
	if (idx > 0) {
		const engine = key.slice(0, idx);
		if (engine === "typst" || engine === "html") {
			return { engine, id: key.slice(idx + 1) };
		}
	}
	return { engine: "html", id: key };
}

export const TYPST_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
