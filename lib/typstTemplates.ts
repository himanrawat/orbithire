/**
 * Server-only: read the Typst template catalog from templates/typst/<id>/meta.json.
 * The directory is TYPST_TEMPLATES_DIR or <cwd>/templates/typst.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import {
	TYPST_ENGINE_LABEL,
	TYPST_ID_RE,
	type TemplateInfo,
	type TemplateKind,
} from "@/lib/templateCatalog";

export function typstTemplatesDir(): string {
	return process.env.TYPST_TEMPLATES_DIR || path.join(process.cwd(), "templates", "typst");
}

let cache: { at: number; list: TemplateInfo[] } | null = null;
const CACHE_MS = process.env.NODE_ENV === "production" ? 10 * 60_000 : 5_000;

interface TypstMeta {
	id?: string;
	name?: string;
	kind?: TemplateKind;
	description?: string;
	regions?: string[];
	photo?: boolean;
	onePage?: boolean;
	accent?: { default?: string; customizable?: boolean };
	page?: { default?: string };
	pairsWith?: string;
	fonts?: string[];
}

function tagsFor(meta: TypstMeta): string[] {
	const tags: string[] = [];
	if (meta.onePage) tags.push("1 Page");
	if (meta.photo) tags.push("Photo");
	if (meta.kind === "resume" && !meta.photo) tags.push("ATS-Friendly");
	const regions = (meta.regions || []).filter((r) => r !== "global");
	if (regions.length > 0) tags.push(regions.slice(0, 3).join("/"));
	return tags;
}

export async function listTypstTemplates(): Promise<TemplateInfo[]> {
	if (cache && Date.now() - cache.at < CACHE_MS) return cache.list;
	const dir = typstTemplatesDir();
	let entries: string[] = [];
	try {
		entries = await fs.readdir(dir);
	} catch {
		console.warn(`[typstTemplates] templates dir not found: ${dir}`);
		return [];
	}
	const list: TemplateInfo[] = [];
	for (const id of entries.sort()) {
		if (!TYPST_ID_RE.test(id)) continue;
		let meta: TypstMeta;
		try {
			meta = JSON.parse(await fs.readFile(path.join(dir, id, "meta.json"), "utf8"));
		} catch {
			continue;
		}
		const kind: TemplateKind = meta.kind === "cover_letter" ? "cover_letter" : "resume";
		list.push({
			key: `typst:${id}`,
			id,
			engine: "typst",
			kind,
			name: meta.name || id,
			engineLabel: TYPST_ENGINE_LABEL,
			style: kind === "cover_letter" ? "Cover letter" : meta.photo ? "EU / Photo" : meta.onePage ? "One page" : "Resume",
			description: meta.description || "",
			tags: tagsFor(meta),
			thumbnailUrl: `/api/templates/typst/${id}/thumbnail`,
			photo: !!meta.photo,
			onePage: !!meta.onePage,
			accentDefault: meta.accent?.default ?? null,
			accentCustomizable: meta.accent?.customizable !== false,
			paperDefault: meta.page?.default === "letter" ? "letter" : "a4",
			pairsWith: meta.pairsWith ?? null,
		});
	}
	cache = { at: Date.now(), list };
	return list;
}

export async function getTypstTemplate(id: string): Promise<TemplateInfo | null> {
	return (await listTypstTemplates()).find((t) => t.id === id) ?? null;
}

export async function readTypstThumbnail(id: string): Promise<Buffer | null> {
	if (!TYPST_ID_RE.test(id)) return null;
	try {
		return await fs.readFile(path.join(typstTemplatesDir(), id, "thumbnail.png"));
	} catch {
		return null;
	}
}
