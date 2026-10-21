/**
 * Template catalog shared by server and client code (no server imports).
 *
 * All generated documents use Typst templates from templates/typst/<id>/
 * (meta.json + thumbnail.png), rendered by the worker's render_pdf task.
 *
 * The old HTML templates (Puppeteer) were retired in Phase 7. Their ids can
 * still arrive from old clients, bookmarks or user settings, so
 * `resolveTemplateId` maps them to the closest Typst template. The same
 * mapping is applied to stored rows by
 * supabase/migrations/20250101000027_retire_html.sql — keep the two in sync.
 *
 * `engine = 'html'` rows that remain in the database are PDFs that cannot be
 * re-rendered (imported PDFs, or legacy rows without structured content);
 * they are served as stored files only.
 */
import type { DocumentEngine } from "@/lib/types/database";

export type TemplateKind = "resume" | "cover_letter";

export interface TemplateInfo {
	/** "typst:<id>" – kept for stable React keys / old URLs */
	key: string;
	id: string;
	engine: DocumentEngine;
	kind: TemplateKind;
	name: string;
	/** Short label shown on the card */
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
	/** The cover letter template matching this resume template (or vice versa) */
	pairsWith?: string | null;
}

export const TYPST_ENGINE_LABEL = "Typst";

export const DEFAULT_TYPST_RESUME = "modern";
export const DEFAULT_TYPST_COVER = "cover-modern";

/**
 * Retired HTML template id -> closest Typst resume template.
 * (Mirrored in migration 027; see docs in README "Templates".)
 */
export const LEGACY_HTML_RESUME_MAP: Record<string, string> = {
	standard: "moderncv", // sans, centred header, ruled section titles
	professional: "ats-classic", // serif executive
	even: "modern", // flat sans
	elegant: "ats-classic", // Georgia serif, detailed
	flat: "modern", // contemporary sans
	spartacus: "modern", // bold sans
	paper: "ats-classic", // minimal serif
	compact: "compact", // dense one-page ATS
	modern: "modern", // two-column sans -> accent-header sans
};

/** The single HTML cover letter layout was a Georgia serif letter. */
export const LEGACY_HTML_COVER = "cover-classic";

export const TYPST_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Normalise a template id from a request: strips an "<engine>:" prefix,
 * maps retired HTML ids and falls back to the default for the kind.
 * The result still has to be checked against the catalog.
 */
export function resolveTemplateId(kind: TemplateKind, raw: unknown): string {
	let id = typeof raw === "string" ? raw.trim() : "";
	let legacy = false;
	const idx = id.indexOf(":");
	if (idx > 0) {
		legacy = id.slice(0, idx) === "html";
		id = id.slice(idx + 1);
	}
	if (!id) return kind === "resume" ? DEFAULT_TYPST_RESUME : DEFAULT_TYPST_COVER;
	if (kind === "resume") {
		// "modern" / "compact" exist in both engines and map to themselves.
		return LEGACY_HTML_RESUME_MAP[id] ?? id;
	}
	if (legacy || id === "professional") return LEGACY_HTML_COVER;
	return id;
}
