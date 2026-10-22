/**
 * Document schemas the MCP server validates before saving (and publishes via
 * get_resume_schema). One source of truth: Zod (v4 API) → JSON Schema.
 *
 * Resume = JSON Resume v1 (https://jsonresume.org/schema) as stored in
 * resumes.content_json and rendered by templates/typst/_lib/data.typ, plus the
 * few NextMilestone extensions those templates read (EU personal details, custom
 * sections, meta.sectionOrder/hiddenSections/labels). Objects are strict:
 * unknown keys are rejected so a typo (e.g. "company" instead of "name")
 * never silently drops content from the PDF.
 */
import { z } from "zod/v4";

const DATE_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const s = (max = 300) => z.string().trim().max(max);
const text = (max = 2000) => z.string().trim().max(max);
const url = z.string().trim().max(500).describe("Absolute URL, e.g. https://example.com");
const date = z
	.string()
	.trim()
	.regex(DATE_RE, "Use ISO dates: YYYY, YYYY-MM or YYYY-MM-DD")
	.describe("ISO 8601 date: YYYY, YYYY-MM or YYYY-MM-DD");
const endDate = z
	.string()
	.trim()
	.regex(/^(\d{4}(-\d{2}(-\d{2})?)?|[Pp]resent)$/, "Use YYYY, YYYY-MM, YYYY-MM-DD or 'Present' (or omit endDate for a current role)")
	.describe("ISO date, or omit (or 'Present') for an ongoing role");
const bullets = (max = 12) => z.array(text(600)).max(max);
const keywords = z.array(s(80)).max(40);

const location = z.strictObject({
	address: s().optional(),
	postalCode: s(40).optional(),
	city: s(120).optional(),
	countryCode: s(10).optional().describe("ISO-3166-1 alpha-2, e.g. IN, US, DE"),
	region: s(120).optional(),
});

const basics = z
	.strictObject({
		name: s(120).min(1, "basics.name is required"),
		label: s(160).optional().describe("Headline under the name, e.g. 'Senior Frontend Engineer'"),
		image: url.optional().describe("Photo URL; only the eu-photo template shows it. Usually omit (the profile photo is used)."),
		email: s(200).optional(),
		phone: s(60).optional(),
		url: url.optional().describe("Personal website / portfolio"),
		summary: text(1500).optional().describe("2–4 sentence professional summary tailored to the job"),
		location: z.union([location, s(200)]).optional(),
		profiles: z
			.array(z.strictObject({ network: s(60), username: s(120).optional(), url: url.optional() }))
			.max(10)
			.optional(),
		birthDate: s(40).optional().describe("EU CVs only (eu-photo)"),
		placeOfBirth: s(120).optional(),
		nationality: s(120).optional(),
		workPermit: s(200).optional(),
		drivingLicense: s(60).optional(),
		maritalStatus: s(60).optional(),
		personalDetails: z.array(z.strictObject({ label: s(60), value: s(200) })).max(12).optional(),
	})
	.describe("Contact details and summary");

const work = z.strictObject({
	name: s(160).describe("Employer / company name"),
	position: s(160).describe("Job title"),
	location: z.union([s(160), location]).optional(),
	url: url.optional(),
	description: text(300).optional().describe("One line about the company"),
	startDate: date.optional(),
	endDate: endDate.optional(),
	summary: text(1000).optional(),
	highlights: bullets(12).optional().describe("Achievement bullets – facts from the candidate's profile only"),
});

const education = z.strictObject({
	institution: s(200),
	url: url.optional(),
	area: s(200).optional().describe("Field of study, e.g. Computer Science"),
	studyType: s(120).optional().describe("Degree, e.g. Bachelor of Science, M.Sc."),
	location: z.union([s(160), location]).optional(),
	startDate: date.optional(),
	endDate: endDate.optional(),
	score: s(40).optional().describe("GPA / grade"),
	courses: z.array(s(160)).max(20).optional(),
	honors: z.array(s(200)).max(10).optional(),
	summary: text(600).optional(),
});

const sectionMeta = z.enum([
	"summary",
	"experience",
	"work",
	"education",
	"skills",
	"projects",
	"certificates",
	"awards",
	"publications",
	"volunteer",
	"languages",
	"interests",
	"references",
	"custom",
]);

export const resumeSchema = z
	.strictObject({
		$schema: z.string().optional(),
		basics,
		work: z.array(work).max(20).optional().describe("Work experience, most recent first"),
		volunteer: z
			.array(
				z.strictObject({
					organization: s(200),
					position: s(160).optional(),
					url: url.optional(),
					startDate: date.optional(),
					endDate: endDate.optional(),
					summary: text(600).optional(),
					highlights: bullets(8).optional(),
				})
			)
			.max(10)
			.optional(),
		education: z.array(education).max(10).optional(),
		awards: z
			.array(z.strictObject({ title: s(200), date: date.optional(), awarder: s(200).optional(), summary: text(600).optional() }))
			.max(15)
			.optional(),
		certificates: z
			.array(z.strictObject({ name: s(200), date: date.optional(), issuer: s(200).optional(), url: url.optional() }))
			.max(20)
			.optional(),
		publications: z
			.array(
				z.strictObject({
					name: s(300),
					publisher: s(200).optional(),
					releaseDate: date.optional(),
					url: url.optional(),
					summary: text(600).optional(),
				})
			)
			.max(20)
			.optional(),
		skills: z
			.array(
				z.strictObject({
					name: s(80).describe("Skill group, e.g. 'Frontend'"),
					level: s(40).optional(),
					keywords: keywords.optional(),
				})
			)
			.max(15)
			.optional(),
		languages: z.array(z.strictObject({ language: s(60), fluency: s(60).optional() })).max(10).optional(),
		interests: z.array(z.strictObject({ name: s(80), keywords: keywords.optional() })).max(10).optional(),
		references: z.array(z.strictObject({ name: s(120), reference: text(800).optional() })).max(5).optional(),
		projects: z
			.array(
				z.strictObject({
					name: s(160),
					description: text(600).optional(),
					highlights: bullets(8).optional(),
					keywords: keywords.optional(),
					startDate: date.optional(),
					endDate: endDate.optional(),
					url: url.optional(),
					roles: z.array(s(80)).max(5).optional(),
					entity: s(160).optional(),
					type: s(60).optional(),
				})
			)
			.max(15)
			.optional(),
		customSections: z
			.array(
				z.strictObject({
					title: s(80),
					entries: z
						.array(
							z.strictObject({
								title: s(200).optional(),
								subtitle: s(200).optional(),
								date: date.optional(),
								startDate: date.optional(),
								endDate: endDate.optional(),
								location: s(160).optional(),
								url: url.optional(),
								description: text(800).optional(),
								highlights: bullets(8).optional(),
							})
						)
						.max(15),
				})
			)
			.max(5)
			.optional()
			.describe("NextMilestone extension: extra titled sections"),
		meta: z
			.strictObject({
				sectionOrder: z.array(sectionMeta).max(14).optional(),
				hiddenSections: z.array(sectionMeta).max(14).optional(),
				labels: z.record(z.string(), s(60)).optional().describe("Override section titles, e.g. {\"experience\": \"Berufserfahrung\"}"),
				lang: s(10).optional(),
				accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "accent must be #RRGGBB").optional(),
				paper: z.enum(["a4", "letter"]).optional(),
				canonical: z.string().optional(),
				version: z.string().optional(),
				lastModified: z.string().optional(),
			})
			.optional(),
	})
	.superRefine((r, ctx) => {
		if (!r.work?.length && !r.education?.length && !r.skills?.length) {
			ctx.addIssue({
				code: "custom",
				message: "A resume needs at least one of work, education or skills",
				path: [],
			});
		}
	});

export type ResumeJson = z.infer<typeof resumeSchema>;

export const coverLetterSchema = z.strictObject({
	recipient: z
		.strictObject({
			name: s(120).optional().describe("Hiring manager's name if known from the posting; otherwise omit"),
			title: s(160).optional(),
			company: s(160).optional(),
			address: z.union([z.array(s(200)).max(5), s(500)]).optional(),
		})
		.optional(),
	date: date.optional().describe("Defaults to today"),
	subject: s(200).optional().describe("e.g. 'Application for Senior Frontend Engineer'"),
	salutation: s(160).min(1).describe("e.g. 'Dear Ms. Patel,' or 'Dear Hiring Manager,'"),
	paragraphs: z.array(text(1500).min(1)).min(1).max(8).describe("Body paragraphs, 3–5 is typical; plain text, no markdown"),
	closing: s(80).min(1).describe("e.g. 'Sincerely,'"),
	signature: s(120).optional().describe("Defaults to the candidate's name"),
});

export type CoverLetterJson = z.infer<typeof coverLetterSchema>;

/** JSON Schemas published by get_resume_schema. */
export function resumeJsonSchema() {
	return z.toJSONSchema(resumeSchema, { target: "draft-7", unrepresentable: "any" });
}
export function coverLetterJsonSchema() {
	return z.toJSONSchema(coverLetterSchema, { target: "draft-7", unrepresentable: "any" });
}

// Frequent field-name mistakes → the JSON Resume name, for actionable errors.
const KEY_HINTS: Record<string, string> = {
	company: "name",
	employer: "name",
	title: "position (work) / name (projects, certificates)",
	role: "position",
	bullets: "highlights",
	achievements: "highlights",
	responsibilities: "highlights",
	degree: "studyType",
	school: "institution",
	university: "institution",
	field: "area",
	major: "area",
	gpa: "score",
	start_date: "startDate",
	end_date: "endDate",
	start: "startDate",
	end: "endDate",
	experience: "work",
	certifications: "certificates",
	skill: "skills",
	linkedin: "basics.profiles[] with network 'LinkedIn'",
	github: "basics.profiles[] with network 'GitHub'",
	website: "url",
	headline: "label",
	body: "paragraphs",
	content: "paragraphs",
	greeting: "salutation",
	signoff: "closing",
	sign_off: "closing",
};

function pathText(path: readonly PropertyKey[]): string {
	let out = "";
	for (const p of path) {
		if (typeof p === "number") out += `[${p}]`;
		else out += out ? `.${String(p)}` : String(p);
	}
	return out || "(root)";
}

/** Zod issues → short, actionable lines for an LLM caller. */
export function formatIssues(error: z.ZodError, max = 15): string[] {
	const lines: string[] = [];
	for (const issue of error.issues.slice(0, max)) {
		const where = pathText(issue.path);
		if (issue.code === "unrecognized_keys") {
			const keys = (issue as { keys: string[] }).keys;
			const hints = keys
				.map((k) => (KEY_HINTS[k] ? `"${k}" → use "${KEY_HINTS[k]}"` : `"${k}"`))
				.join(", ");
			lines.push(`${where}: unknown field(s) ${hints}. See get_resume_schema for the allowed fields.`);
		} else if (issue.code === "invalid_type") {
			const expected = (issue as { expected?: string }).expected;
			const missing = /received undefined/.test(issue.message) || issue.message === "Invalid input";
			lines.push(
				missing
					? `${where}: required field missing${expected ? ` (expected ${expected})` : ""}`
					: `${where}: ${issue.message}`
			);
		} else {
			lines.push(`${where}: ${issue.message}`);
		}
	}
	if (error.issues.length > max) lines.push(`…and ${error.issues.length - max} more problem(s).`);
	return lines;
}
