import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImportUser } from "@/lib/import/server";
import { isPdf, pdfToText } from "@/lib/import/pdfText";
import {
	ALL_PROFILE_FIELDS,
	EXTENDED_FIELDS,
	diffProfile,
	parseClaudeProfile,
	sanitizeProfileValue,
	type ProfileField,
} from "@/lib/import/profile";
import { parseJson } from "@/lib/api";
import { importProfileSchema } from "@/lib/schemas/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

async function loadCurrent(supabase: SupabaseClient, userId: string) {
	const { data, error } = await supabase
		.from("profiles")
		.select(
			"full_name, headline, location, phone, portfolio_url, experience_summary, skills, target_job_titles, preferred_locations, salary_range, extended_profile"
		)
		.eq("id", userId)
		.maybeSingle();
	if (error) throw new Error(error.message);
	let extended: Record<string, unknown> = {};
	const raw = data?.extended_profile;
	if (typeof raw === "string") {
		try {
			extended = JSON.parse(raw) || {};
		} catch {
			extended = {};
		}
	} else if (raw && typeof raw === "object") {
		extended = raw as Record<string, unknown>;
	}
	const current: Record<string, unknown> = { ...(data || {}) };
	delete current.extended_profile;
	current.work_experience = extended.work_experience ?? [];
	current.education = extended.education ?? [];
	return { current, extended };
}

/**
 * POST /api/import/profile
 *
 * Preview (multipart): profile = ai-job-search CLAUDE.md, cv = optional CV (.pdf or .txt)
 *   -> { rows: [{ field, label, current, proposed, changed, defaultSelected }] }
 * Apply (JSON): { fields: { <field>: <value>, ... } } – only the fields the user ticked.
 *   Profile columns are updated directly; work_experience / education are merged into
 *   extended_profile (the master resume data). Nothing else is touched.
 */
export async function POST(req: NextRequest) {
	const auth = await getImportUser();
	if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { supabase, userId } = auth;
	const contentType = req.headers.get("content-type") || "";

	if (contentType.includes("multipart/form-data")) {
		const form = await req.formData();
		const profile = form.get("profile");
		if (!(profile instanceof File)) return NextResponse.json({ error: "profile (CLAUDE.md) is required" }, { status: 400 });
		if (profile.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 413 });
		const markdown = await profile.text();
		let cvText: string | null = null;
		const cv = form.get("cv");
		if (cv instanceof File && cv.size > 0) {
			if (cv.size > MAX_BYTES) return NextResponse.json({ error: "CV too large" }, { status: 413 });
			const buf = Buffer.from(await cv.arrayBuffer());
			cvText = isPdf(buf) ? await pdfToText(buf) : buf.toString("utf8");
		}
		const proposed = parseClaudeProfile(markdown, cvText);
		if (Object.keys(proposed).length === 0) {
			return NextResponse.json({ error: "No candidate profile found (expected '### Identity', '### Professional Experience', ...)" }, { status: 422 });
		}
		const { current } = await loadCurrent(supabase, userId);
		return NextResponse.json({ rows: diffProfile(current, proposed) });
	}

	const parsed = await parseJson(req, importProfileSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;
	const update: Record<string, unknown> = {};
	const extendedPatch: Record<string, unknown> = {};
	const applied: ProfileField[] = [];
	for (const [k, v] of Object.entries(body.fields as Record<string, unknown>)) {
		if (!(ALL_PROFILE_FIELDS as string[]).includes(k)) continue;
		const field = k as ProfileField;
		const clean = sanitizeProfileValue(field, v);
		if (clean === undefined) return NextResponse.json({ error: `Invalid value for ${field}` }, { status: 400 });
		if (EXTENDED_FIELDS.includes(field)) extendedPatch[field] = clean;
		else update[field] = clean;
		applied.push(field);
	}
	if (!applied.length) return NextResponse.json({ error: "No fields selected" }, { status: 400 });
	if (update.full_name === "") return NextResponse.json({ error: "Full name cannot be empty" }, { status: 400 });

	if (Object.keys(extendedPatch).length) {
		const { extended } = await loadCurrent(supabase, userId);
		update.extended_profile = JSON.stringify({ ...extended, ...extendedPatch });
	}
	update.updated_at = new Date().toISOString();
	const { error } = await supabase.from("profiles").update(update).eq("id", userId);
	if (error) return NextResponse.json({ error: `Could not update profile: ${error.message}` }, { status: 500 });
	return NextResponse.json({ ok: true, applied });
}
