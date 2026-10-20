/**
 * Server-only: the candidate profile as the MCP server exposes it – the
 * profile fields plus a "master resume" in JSON Resume shape built from the
 * profile (profiles + extended_profile), which is the factual source the AI
 * tailors from. Every query is scoped to `userId`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const ym = (v: unknown): string | undefined => {
	const s = str(v);
	const m = s.match(/^(\d{4})(-\d{2})?/);
	return m ? m[0] : s || undefined;
};
const lines = (v: unknown): string[] =>
	str(v)
		.split(/\n|•|▪|★/)
		.map((l) => l.replace(/^[-*]\s+/, "").trim())
		.filter((l) => l.length > 2);

function compact<T extends Record<string, unknown>>(o: T): T {
	for (const k of Object.keys(o)) {
		const v = o[k];
		if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) delete o[k];
	}
	return o;
}

export interface CandidateProfile {
	profile: Record<string, unknown>;
	master_resume: Record<string, unknown>;
	is_empty: boolean;
}

export async function loadCandidateProfile(service: SupabaseClient, userId: string): Promise<CandidateProfile> {
	const { data, error } = await service
		.from("profiles")
		.select(
			"id, email, resume_email, full_name, headline, phone, location, linkedin_url, portfolio_url, skills, experience_summary, extended_profile, target_job_titles, preferred_locations, work_type, salary_range, start_availability"
		)
		.eq("id", userId)
		.maybeSingle();
	if (error) throw new Error(`Failed to load profile: ${error.message}`);
	const p: Any = data || {};

	let ext: Any = {};
	if (typeof p.extended_profile === "string") {
		try {
			ext = JSON.parse(p.extended_profile) || {};
		} catch {
			ext = {};
		}
	} else if (p.extended_profile && typeof p.extended_profile === "object") {
		ext = p.extended_profile;
	}

	const email = str(p.resume_email) || str(p.email);
	const profiles: Any[] = [];
	if (str(p.linkedin_url)) profiles.push({ network: "LinkedIn", url: str(p.linkedin_url) });
	if (str(ext.github_url)) profiles.push({ network: "GitHub", url: str(ext.github_url) });

	const work = (Array.isArray(ext.work_experience) ? ext.work_experience : []).map((w: Any) =>
		compact({
			name: str(w.company) || str(w.name),
			position: str(w.role) || str(w.title) || str(w.position),
			location: str(w.location) || undefined,
			startDate: ym(w.start_date ?? w.startDate),
			endDate: w.is_current ? undefined : ym(w.end_date ?? w.endDate),
			highlights: lines(w.description),
		})
	);
	const education = (Array.isArray(ext.education) ? ext.education : []).map((e: Any) =>
		compact({
			institution: str(e.institution) || str(e.school),
			studyType: str(e.degree) || str(e.studyType) || undefined,
			area: str(e.field) || str(e.area) || undefined,
			location: str(e.location) || undefined,
			startDate: ym(e.start_date ?? e.startDate),
			endDate: ym(e.end_date ?? e.endDate),
			score: str(e.gpa) || undefined,
		})
	);
	const skillList: string[] = Array.isArray(p.skills) ? p.skills.filter((s: unknown) => typeof s === "string" && s) : [];
	const customSections = (Array.isArray(ext.customSections) ? ext.customSections : [])
		.map((c: Any) => ({
			title: str(c.title),
			entries: (Array.isArray(c.entries) ? c.entries : [])
				.map((x: Any) =>
					compact({
						title: str(x.title) || undefined,
						description: str(x.value) || str(x.description) || undefined,
						url: str(x.link) || str(x.url) || undefined,
					})
				)
				.filter((x: Any) => Object.keys(x).length > 0),
		}))
		.filter((c: Any) => c.title && c.entries.length);
	const details = (Array.isArray(ext.custom_fields) ? ext.custom_fields : [])
		.map((f: Any) => ({ label: str(f.label), value: str(f.value) }))
		.filter((f: Any) => f.label && f.value);

	const master: Any = compact({
		basics: compact({
			name: str(p.full_name),
			label: str(p.headline) || undefined,
			email: email || undefined,
			phone: str(p.phone) || undefined,
			url: str(p.portfolio_url) || undefined,
			summary: str(p.experience_summary) || undefined,
			location: str(p.location) || undefined,
			profiles,
			personalDetails: details,
		}),
		work,
		education,
		skills: skillList.length ? [{ name: "Skills", keywords: skillList }] : [],
		customSections,
	});

	const isEmpty = !str(p.full_name) && work.length === 0 && education.length === 0 && skillList.length === 0;

	return {
		profile: compact({
			name: str(p.full_name) || undefined,
			email: email || undefined,
			headline: str(p.headline) || undefined,
			location: str(p.location) || undefined,
			phone: str(p.phone) || undefined,
			linkedin_url: str(p.linkedin_url) || undefined,
			portfolio_url: str(p.portfolio_url) || undefined,
			summary: str(p.experience_summary) || undefined,
			target_job_titles: Array.isArray(p.target_job_titles) ? p.target_job_titles : [],
			preferred_locations: Array.isArray(p.preferred_locations) ? p.preferred_locations : [],
			work_type: p.work_type || undefined,
			salary_expectation: str(p.salary_range) || undefined,
			start_availability: p.start_availability || undefined,
		}),
		master_resume: master,
		is_empty: isEmpty,
	};
}
