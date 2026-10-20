/**
 * Parse the candidate profile from ai-job-search `CLAUDE.md` (and optionally the
 * text of a recent CV) into proposed OrbitHire profile fields, and diff them
 * against the current profile. Nothing is written here: the user picks fields
 * in the UI and only those are applied (POST /api/import/profile, mode=apply).
 */

export interface ProfileWork {
	id: string;
	company: string;
	role: string;
	location: string;
	start_date: string;
	end_date: string | null;
	description: string;
}

export interface ProfileEducation {
	id: string;
	institution: string;
	degree: string;
	location: string;
	start_date: string;
	end_date: string;
}

export interface ProposedProfile {
	full_name?: string;
	headline?: string;
	location?: string;
	phone?: string;
	portfolio_url?: string;
	experience_summary?: string;
	skills?: string[];
	target_job_titles?: string[];
	preferred_locations?: string[];
	salary_range?: string;
	work_experience?: ProfileWork[];
	education?: ProfileEducation[];
}

export type ProfileField = keyof ProposedProfile;

/** Columns on `profiles` vs keys inside `profiles.extended_profile` (the master resume data). */
export const PROFILE_COLUMNS: ProfileField[] = [
	"full_name",
	"headline",
	"location",
	"phone",
	"portfolio_url",
	"experience_summary",
	"skills",
	"target_job_titles",
	"preferred_locations",
	"salary_range",
];
export const EXTENDED_FIELDS: ProfileField[] = ["work_experience", "education"];
export const ALL_PROFILE_FIELDS: ProfileField[] = [...PROFILE_COLUMNS, ...EXTENDED_FIELDS];

export const FIELD_LABELS: Record<ProfileField, string> = {
	full_name: "Full name",
	headline: "Headline",
	location: "Location",
	phone: "Phone",
	portfolio_url: "Website",
	experience_summary: "Summary",
	skills: "Skills",
	target_job_titles: "Target job titles",
	preferred_locations: "Preferred locations",
	salary_range: "Salary expectation",
	work_experience: "Work experience (master resume)",
	education: "Education (master resume)",
};

const MONTHS: Record<string, string> = {
	jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
	jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "Jan 2025" -> "2025-01"; "2024" -> "2024"; "Present" -> null */
export function toYearMonth(s: string): string | null {
	const t = s.trim();
	if (!t || /present|current|now/i.test(t)) return null;
	const m = t.match(/^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
	if (m && MONTHS[m[1].toLowerCase()]) return `${m[2]}-${MONTHS[m[1].toLowerCase()]}`;
	const y = t.match(/(\d{4})/);
	return y ? y[1] : t;
}

const stripMd = (s: string) => s.replace(/\*\*/g, "").replace(/`/g, "").trim();
const stripComments = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "");

/** Body of a `### Heading` (or `## Heading`) section, up to the next heading. */
function section(md: string, heading: string): string {
	const re = new RegExp(`^#{2,4}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "mi");
	const m = re.exec(md);
	if (!m) return "";
	const rest = md.slice(m.index + m[0].length);
	const end = rest.search(/^#{1,4}\s/m);
	return end === -1 ? rest : rest.slice(0, end);
}

/** `- **Key:** value` lines of a section. */
function keyValues(body: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of body.split("\n")) {
		const m = line.match(/^\s*-\s+\*\*([^*:]+):?\*\*:?\s*(.*)$/);
		if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
	}
	return out;
}

const splitList = (s: string) =>
	s
		.split(/,(?![^()]*\))/)
		.map((x) => x.trim().replace(/^and\s+/i, "").replace(/\.$/, "").trim())
		.filter(Boolean);

let idCounter = 0;
const newId = () =>
	typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `import-${Date.now()}-${idCounter++}`;

export function parseClaudeProfile(markdown: string, cvText?: string | null): ProposedProfile {
	const md = stripComments(markdown);
	const out: ProposedProfile = {};

	// ---- Identity
	const identity = keyValues(section(md, "Identity"));
	if (identity.name) out.full_name = stripMd(identity.name);
	if (identity.location) {
		const full = stripMd(identity.location);
		const base = full.replace(/\s*\(.*$/, "").trim();
		out.location = base;
		const prefs = [base];
		if (/anywhere in India/i.test(full) && !/^India$/i.test(base)) prefs.push("India");
		if (/remote/i.test(full)) prefs.push("Remote");
		out.preferred_locations = prefs;
	}
	if (identity["linkedin headline"]) out.headline = stripMd(identity["linkedin headline"]).replace(/^"|"$/g, "");

	// ---- Experience: "- **Role** (Jan 2025 - Present) - **Company**" + indented bullets
	const expBody = section(md, "Professional Experience");
	const work: ProfileWork[] = [];
	let current: ProfileWork | null = null;
	for (const line of expBody.split("\n")) {
		const head = line.match(/^-\s+\*\*(.+?)\*\*\s*\(([^)]*)\)\s*[-–—]\s*(.+)$/);
		if (head) {
			const [start, end] = head[2].split(/\s+[-–—]\s+/);
			current = {
				id: newId(),
				role: stripMd(head[1]),
				company: stripMd(head[3]),
				location: "",
				start_date: toYearMonth(start || "") || "",
				end_date: end ? toYearMonth(end) : null,
				description: "",
			};
			work.push(current);
			continue;
		}
		const bullet = line.match(/^\s{2,}-\s+(.*)$/);
		if (bullet && current) current.description += (current.description ? "\n" : "") + `• ${stripMd(bullet[1])}`;
	}
	if (work.length) out.work_experience = work;

	// ---- Education: "- **Degree** (2024) - Institution"
	const edu: ProfileEducation[] = [];
	for (const line of section(md, "Education").split("\n")) {
		const m = line.match(/^-\s+\*\*(.+?)\*\*\s*\(([^)]*)\)\s*[-–—]\s*(.+)$/);
		if (m) {
			edu.push({
				id: newId(),
				degree: stripMd(m[1]),
				institution: stripMd(m[3]),
				location: "",
				start_date: "",
				end_date: toYearMonth(m[2]) || "",
			});
		}
	}
	if (edu.length) out.education = edu;

	// ---- Skills: Primary + Secondary
	const skills = keyValues(section(md, "Technical Skills"));
	const skillList = [...splitList(skills.primary || ""), ...splitList(skills.secondary || "")];
	if (skillList.length) out.skills = Array.from(new Set(skillList));

	// ---- Target titles: first "Area: title, title, ..." bullet of Target Sectors
	const sectors = section(md, "Target Sectors");
	const first = sectors.split("\n").find((l) => /^-\s+[^:]+:/.test(l));
	if (first) {
		const titles = splitList(first.replace(/^-\s+[^:]+:\s*/, "")).filter((t) => !/\broles?$/i.test(t) && t.split(" ").length <= 4);
		if (titles.length) out.target_job_titles = titles;
	}

	// ---- Salary floor from deal-breakers ("below INR 12 lakh per annum")
	const deal = section(md, "Deal-breakers");
	const sal = deal.match(/below\s+(INR|USD|EUR|GBP|₹|\$)\s*([\d.,]+)\s*(lakh|lakhs|LPA|k|thousand)?/i);
	if (sal) {
		const unit = sal[3] && /lakh|lpa/i.test(sal[3]) ? " LPA" : sal[3] ? ` ${sal[3]}` : "";
		out.salary_range = `${sal[1].toUpperCase()} ${sal[2]}${unit}+ (minimum)`;
	}

	// ---- From the CV text (optional): summary, phone, website
	if (cvText) {
		const text = cvText.replace(/\r/g, "");
		const phone = text.match(/\+\d{1,3}[\d\s-]{7,14}\d/);
		if (phone) out.phone = phone[0].replace(/\s+/g, " ").trim();
		const site = Array.from(text.matchAll(/(?<![@\w.-])((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.(?:in|com|dev|io|me|net|org|app|design))\b(?![@.\w])/gi))
			.map((m) => m[1])
			.find((d) => !/linkedin|github/i.test(d));
		if (site) out.portfolio_url = /^https?:/i.test(site) ? site : `https://${site}`;
		const summary = extractCvSummary(text);
		if (summary) out.experience_summary = summary;
	}
	return out;
}

/** First prose paragraph of a CV (after the contact header, before the first section heading). */
export function extractCvSummary(text: string): string | null {
	const lines = text.split("\n").map((l) => l.trim());
	const buf: string[] = [];
	for (const line of lines) {
		if (!line) {
			if (buf.join(" ").length > 120) break;
			continue;
		}
		const isHeading = /^[A-Z][A-Za-z &]{2,40}$/.test(line) && line.split(" ").length <= 4;
		if (isHeading && buf.join(" ").length > 120) break;
		// skip the contact header (email, phone, profile links) until the prose starts
		if (!buf.length && /@|\+\d{2}|linkedin|github|https?:\/\//i.test(line)) continue;
		// sentence-like lines (long, end with punctuation or continue)
		if (line.length > 60 || (buf.length && !isHeading)) buf.push(line);
	}
	const joined = buf.join(" ").replace(/\s+/g, " ").trim();
	if (joined.length < 80) return null;
	// cut at the end of the paragraph's last sentence
	const end = joined.lastIndexOf(".");
	return (end > 80 ? joined.slice(0, end + 1) : joined).slice(0, 1200);
}

export interface CurrentProfile {
	[key: string]: unknown;
}

export interface ProfileDiffRow {
	field: ProfileField;
	label: string;
	current: unknown;
	proposed: unknown;
	changed: boolean;
	/** Pre-ticked in the UI: proposed value present and current value empty. */
	defaultSelected: boolean;
}

const isEmpty = (v: unknown) =>
	v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Comparison ignoring generated ids. */
function normalize(v: unknown): unknown {
	if (Array.isArray(v)) return v.map(normalize);
	if (v && typeof v === "object") {
		const o: Record<string, unknown> = {};
		// sorted keys + no generated ids, so stored and freshly parsed entries compare equal
		for (const k of Object.keys(v as Record<string, unknown>).sort()) {
			if (k !== "id") o[k] = normalize((v as Record<string, unknown>)[k] ?? "");
		}
		return o;
	}
	return typeof v === "string" ? v.trim() : v ?? "";
}

export function diffProfile(current: CurrentProfile, proposed: ProposedProfile): ProfileDiffRow[] {
	return ALL_PROFILE_FIELDS.filter((f) => proposed[f] !== undefined).map((field) => {
		const cur = current[field];
		const prop = proposed[field];
		const changed = JSON.stringify(normalize(cur)) !== JSON.stringify(normalize(prop));
		return {
			field,
			label: FIELD_LABELS[field],
			current: cur ?? null,
			proposed: prop,
			changed,
			defaultSelected: changed && isEmpty(cur),
		};
	});
}

/** Validate a client-sent value for a field before writing it. */
export function sanitizeProfileValue(field: ProfileField, value: unknown): unknown {
	const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
	const strArr = (v: unknown) =>
		Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim().slice(0, 200)).slice(0, 100) : undefined;
	switch (field) {
		case "skills":
		case "target_job_titles":
		case "preferred_locations":
			return strArr(value);
		case "experience_summary":
			return str(value, 4000);
		case "work_experience":
			return Array.isArray(value)
				? value.slice(0, 30).map((w: Record<string, unknown>) => ({
						id: str(w?.id, 64) || newId(),
						company: str(w?.company, 200) || "",
						role: str(w?.role, 200) || "",
						location: str(w?.location, 200) || "",
						start_date: str(w?.start_date, 20) || "",
						end_date: str(w?.end_date, 20) || null,
						description: str(w?.description, 5000) || "",
					}))
				: undefined;
		case "education":
			return Array.isArray(value)
				? value.slice(0, 20).map((e: Record<string, unknown>) => ({
						id: str(e?.id, 64) || newId(),
						institution: str(e?.institution, 200) || "",
						degree: str(e?.degree, 200) || "",
						location: str(e?.location, 200) || "",
						start_date: str(e?.start_date, 20) || "",
						end_date: str(e?.end_date, 20) || "",
					}))
				: undefined;
		default:
			return str(value, 500);
	}
}
