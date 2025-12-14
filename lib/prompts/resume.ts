/**
 * Harvard-style ATS-friendly Resume & Cover Letter Prompt Builder
 * MERGED BEST VERSION - Full rewritten file (clean + consistent)
 *
 * Features:
 * - International resume considerations (region, language, photo policies)
 * - GPA and academic details with smart thresholds
 * - Multiple roles per company with promotion handling
 * - Multilingual support (10 languages)
 * - Recruiter-side explanation/audit features
 * - Skill evidence mapping (proves each skill)
 * - Constraints matching (location, notice period)
 * - JD title extraction rules
 * - Safe date parsing (no "Invalid Date")
 * - Cover letter generation
 * - Modular architecture
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type ResumeRegion =
	| "us"
	| "uk"
	| "eu"
	| "asia"
	| "latam"
	| "middle-east"
	| "international";

export type ResumeLanguage =
	| "en"
	| "es"
	| "fr"
	| "de"
	| "pt"
	| "it"
	| "zh"
	| "ja"
	| "ko"
	| "ar";

export type WorkArrangement = "onsite" | "remote" | "hybrid";

export type LanguageProficiency =
	| "native"
	| "fluent"
	| "professional"
	| "intermediate"
	| "basic";

export interface AcademicProject {
	name: string;
	description: string;
	technologies?: string[];
}

export interface EducationEntry {
	institution: string;
	degree: string;
	field: string;
	startDate?: string;
	endDate?: string;
	gpa?: number;
	gpaScale?: number;
	honors?: string[];
	relevantCoursework?: string[];
	thesis?: string;
	academicProjects?: AcademicProject[];
}

export interface PreviousTitle {
	title: string;
	startDate: string;
	endDate: string;
	highlights: string[];
}

export interface ExperienceEntry {
	company: string;
	title: string;
	startDate: string;
	endDate?: string;
	location?: string;
	workArrangement?: WorkArrangement;
	highlights: string[];
	previousTitles?: PreviousTitle[];
}

export interface LanguageSkill {
	language: string;
	proficiency: LanguageProficiency;
}

export interface InternationalDetails {
	nationality?: string;
	workAuthorization?: string;
	languages?: LanguageSkill[];
	willingToRelocate?: boolean;
	availableFrom?: string;
	noticePeriod?: string; // e.g., "Immediate", "15 days", "30 days"
}

export interface CustomSectionEntry {
	title: string;
	description: string;
	date?: string;
	url?: string;
}

export interface CustomSection {
	title: string;
	entries: CustomSectionEntry[];
}

export interface ResumeProfile {
	name: string;
	headline?: string;
	summary?: string;
	email?: string;
	phone?: string;
	location?: string;
	linkedIn?: string;
	portfolio?: string;
	profilePhotoUrl?: string;

	experience: ExperienceEntry[];
	education: EducationEntry[];
	skills: string[];
	certifications?: string[];
	customSections?: CustomSection[];
	internationalDetails?: InternationalDetails;
}

export interface ResumeGenerationOptions {
	region?: ResumeRegion;
	language?: ResumeLanguage;
	includePhoto?: boolean;
	includeExplanations?: boolean;
	maxPages?: 1 | 2;
	isRecentGraduate?: boolean;
	gpaThreshold?: number;
}

export interface CoverLetterProfile {
	name: string;
	headline?: string;
	summary?: string;
	topExperiences: string[];
	skills: string[];
	internationalDetails?: InternationalDetails;
}

export interface CoverLetterGenerationOptions {
	language?: ResumeLanguage;
	includeExplanations?: boolean;
}

// ============================================================================
// ACTION VERBS BY LANGUAGE
// ============================================================================

export const ACTION_VERBS: Record<ResumeLanguage, string[]> = {
	en: [
		"Led",
		"Spearheaded",
		"Architected",
		"Delivered",
		"Optimized",
		"Drove",
		"Implemented",
		"Accelerated",
		"Reduced",
		"Increased",
		"Generated",
		"Streamlined",
		"Orchestrated",
		"Transformed",
		"Pioneered",
	],
	es: [
		"Lideré",
		"Encabecé",
		"Diseñé",
		"Entregué",
		"Optimicé",
		"Impulsé",
		"Implementé",
		"Aceleré",
		"Reduje",
		"Aumenté",
		"Generé",
		"Simplifiqué",
		"Orquesté",
		"Transformé",
		"Pionereé",
	],
	fr: [
		"Dirigé",
		"Piloté",
		"Conçu",
		"Livré",
		"Optimisé",
		"Conduit",
		"Implémenté",
		"Accéléré",
		"Réduit",
		"Augmenté",
		"Généré",
		"Rationalisé",
		"Orchestré",
		"Transformé",
		"Initié",
	],
	de: [
		"Geleitet",
		"Angeführt",
		"Entwickelt",
		"Geliefert",
		"Optimiert",
		"Vorangetrieben",
		"Implementiert",
		"Beschleunigt",
		"Reduziert",
		"Gesteigert",
		"Generiert",
		"Vereinfacht",
		"Orchestriert",
		"Transformiert",
		"Etabliert",
	],
	pt: [
		"Liderei",
		"Encabecei",
		"Arquitetei",
		"Entreguei",
		"Otimizei",
		"Impulsionei",
		"Implementei",
		"Acelerei",
		"Reduzi",
		"Aumentei",
		"Gerei",
		"Simplifiquei",
		"Orquestrei",
		"Transformei",
		"Pioneirei",
	],
	it: [
		"Guidato",
		"Diretto",
		"Progettato",
		"Consegnato",
		"Ottimizzato",
		"Promosso",
		"Implementato",
		"Accelerato",
		"Ridotto",
		"Aumentato",
		"Generato",
		"Semplificato",
		"Orchestrato",
		"Trasformato",
		"Introdotto",
	],
	zh: [
		"领导",
		"主导",
		"设计",
		"交付",
		"优化",
		"推动",
		"实施",
		"加速",
		"减少",
		"增加",
		"创造",
		"简化",
		"协调",
		"转型",
		"开创",
	],
	ja: [
		"主導",
		"牽引",
		"設計",
		"納品",
		"最適化",
		"推進",
		"実装",
		"加速",
		"削減",
		"増加",
		"創出",
		"効率化",
		"統括",
		"変革",
		"開拓",
	],
	ko: [
		"주도",
		"선도",
		"설계",
		"전달",
		"최적화",
		"추진",
		"구현",
		"가속화",
		"절감",
		"증대",
		"창출",
		"간소화",
		"조율",
		"혁신",
		"개척",
	],
	ar: [
		"قاد",
		"تصدّر",
		"صمّم",
		"سلّم",
		"حسّن",
		"دفع",
		"نفّذ",
		"سرّع",
		"خفّض",
		"زاد",
		"أنتج",
		"بسّط",
		"نسّق",
		"حوّل",
		"ريادة",
	],
};

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

export const RESUME_SYSTEM_PROMPT = `
You are an expert resume optimization specialist following Harvard Office of Career Services standards.
Your job is to transform candidate profiles into powerful, ATS-friendly, results-driven resumes tailored specifically for each job description.

═══════════════════════════════════════════════════════════════
HARD CONSTRAINTS (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════

1) TRUTHFULNESS — NEVER FABRICATE
   - Never invent skills, tools, titles, companies, dates, or metrics
   - If a metric is not present in the input, do NOT fabricate it
   - If impact exists but numbers do not, quantify using scope words WITHOUT numbers
     • BAD: "Increased sales by 40%" (when no data exists)
     • GOOD: "Significantly increased sales through targeted outreach strategy"

2) ATS FORMAT REQUIREMENTS
   - No tables, columns, icons, graphics, emojis, or fancy formatting
   - Use only standard ATS-friendly section headings
   - Clean, simple structure that parses correctly

3) NO PERSONAL PRONOUNS
   - Never use "I", "me", "my", "we", "our" in bullet points

4) TENSE CONSISTENCY
   - Present tense for current roles
   - Past tense for previous roles

5) DATE HANDLING
   - Never output "Invalid Date"
   - If endDate is missing → use "Present"
   - If date is malformed or missing → keep blank or use "Present"

═══════════════════════════════════════════════════════════════
HARVARD QUALITY RULES
═══════════════════════════════════════════════════════════════

A) RESULTS OVER DUTIES
   Every bullet must show IMPACT and ACHIEVEMENT, never just responsibilities.
   • BAD: "Responsible for managing social media accounts"
   • GOOD: "Grew Instagram following 45% (2K to 2.9K) in 3 months through targeted content strategy"

B) ACTION VERBS FIRST
   - Start EVERY bullet with a strong action verb
   - Never start with dates, pronouns, or passive constructions

C) CONCISE & SCANNABLE
   - 10–15 words per bullet maximum
   - Remove filler words: "various", "helped with", "assisted in", "worked on"

D) RELEVANCE ORDERING
   - Reorder bullets within each role so the most job-relevant come first

═══════════════════════════════════════════════════════════════
KEYWORD & ATS MATCH RULES
═══════════════════════════════════════════════════════════════

1) Extract 8–12 critical keywords/phrases from the job description
2) Place 3–4 keywords in summary, 1–2 per role (where truthful)
3) Use EXACT spelling from the job description
4) No keyword stuffing — integration must be natural

═══════════════════════════════════════════════════════════════
SKILL PROOF RULE
═══════════════════════════════════════════════════════════════

Do NOT list a technical skill unless demonstrated in at least one:
• Experience bullet • Project entry • Custom section entry • Certification

Provide skillEvidence mapping: skill → where it's proven.

OUTPUT MUST BE VALID JSON ONLY.
`;

export const COVER_LETTER_SYSTEM_PROMPT = `
You are an expert career coach following Harvard Office of Career Services standards for cover letters.

═══════════════════════════════════════════════════════════════
HARD CONSTRAINTS
═══════════════════════════════════════════════════════════════

1) TRUTHFULNESS - Never invent tools, metrics, titles, or experiences
2) LENGTH - 3–4 paragraphs, under 350 words
3) AVOID GENERIC OPENINGS - Never start with "I am writing to apply..."
4) OUTPUT FORMAT - Plain text only (no markdown, no JSON)

═══════════════════════════════════════════════════════════════
READER-CENTRIC FOCUS
═══════════════════════════════════════════════════════════════

Focus on what you deliver FOR THEM, not what you want from them.
• BAD: "I am looking for a challenging opportunity to grow my skills"
• GOOD: "Your team's recent launch of [Product X] aligns with my 3 years scaling similar platforms"

═══════════════════════════════════════════════════════════════
"I" CONTROL
═══════════════════════════════════════════════════════════════

Do NOT start more than 2 sentences per paragraph with "I".
Vary: "My experience...", "During my tenure at...", "Leading a team of..."

OUTPUT MUST BE PLAIN TEXT ONLY.
`;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Safe date parsing - returns timestamp or null */
function safeDateParse(input?: string): number | null {
	if (!input) return null;
	const t = Date.parse(input);
	return Number.isFinite(t) ? t : null;
}

/** Minimal JSON string escape */
function escapeJsonString(input: string): string {
	return input
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t");
}

/** Get action verbs for a specific language */
export function getActionVerbs(language: ResumeLanguage = "en"): string[] {
	return ACTION_VERBS[language] || ACTION_VERBS.en;
}

/** Get recommended GPA threshold based on scale */
export function getGpaThreshold(scale: number = 4): number {
	const thresholds: Record<number, number> = {
		4: 3.5,
		5: 4.4,
		10: 8.5,
		100: 85,
	};
	return thresholds[scale] || scale * 0.875;
}

/** Determine if candidate qualifies as recent graduate (within 2 years) */
export function isRecentGraduate(education: EducationEntry[]): boolean {
	const twoYearsAgo = new Date();
	twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
	const cutoff = twoYearsAgo.getTime();

	return education.some((edu) => {
		if (!edu.endDate) return true; // currently enrolled
		const t = safeDateParse(edu.endDate);
		if (t === null) return false; // unknown date -> don't assume recent
		return t >= cutoff;
	});
}

// ============================================================================
// MODULAR HELPER FUNCTIONS
// ============================================================================

/** Builds keyword extraction prompt (standalone use) */
export function buildKeywordExtractionPrompt(jobDescription: string): string {
	return `Extract ATS-critical keywords from the job description below.

JOB DESCRIPTION:
${jobDescription}

Return STRICT JSON:
{
  "jobTitleFromJD": "Exact job title if present (check for 'Job Title:'), otherwise empty string",
  "companyName": "Company name if present, otherwise empty string",
  "mustHave": ["Technical skills, tools, certifications explicitly REQUIRED"],
  "goodToHave": ["Preferred/bonus qualifications"],
  "toolsTech": ["Software, platforms, frameworks, languages, databases"],
  "process": ["Methodologies: Agile, Scrum, Kanban, SAFe, CI/CD, Unit testing"],
  "domain": ["Industry terms, domain knowledge"],
  "softSkills": ["Leadership, communication, collaboration, requirements gathering"],
  "responsibilities": ["Core duties as verb phrases"],
  "constraints": {
    "location": "If JD specifies (e.g., Bangalore only) else empty string",
    "noticePeriod": "If JD specifies (e.g., Immediate) else empty string"
  },
  "prioritized": ["8-12 most critical keywords, ranked"],
  "synonyms": { "keyword": ["variant1", "variant2"] }
}

RULES:
1. Exact spelling — Preserve exact casing/spelling from JD in: jobTitleFromJD, prioritized, toolsTech (only when term exists in JD)
2. Title extraction — If JD contains "Job Title:" use the text after it as jobTitleFromJD (trim)
3. No invention — Only extract what's explicitly in the JD
4. Prioritization — Required > preferred, repeated > mentioned once
5. Synonyms — Include common variants even if not in JD (PostgreSQL ↔ Postgres, REST/JSON ↔ REST APIs). Do NOT add completely new technologies.
6. Responsibilities as verbs — "Design scalable systems", "Lead cross-functional teams"
7. Constraints — If JD contains "Location:" or "Notice Period:" capture them

Return ONLY the JSON object.`;
}

/** Builds regional-specific instructions */
export function buildRegionalInstructions(
	region: ResumeRegion,
	includePhoto: boolean = false
): string {
	const instructions: Record<ResumeRegion, string> = {
		us: `### REGIONAL FORMAT: United States
- Do NOT include photo, age, marital status, or nationality
- Keep to 1 page (2 pages only for 10+ years experience)
- Focus on achievements and metrics over personal details`,

		uk: `### REGIONAL FORMAT: United Kingdom
- Do NOT include photo, age, or marital status
- May include nationality/work rights if relevant
- Use British English spelling`,

		eu: `### REGIONAL FORMAT: European Union
- ${includePhoto ? "Include professional photo if provided" : "Photo optional"}
- May include nationality for work authorization
- Include language proficiencies prominently`,

		asia: `### REGIONAL FORMAT: Asia
- ${
			includePhoto
				? "Include professional photo if provided"
				: "Photo commonly expected"
		}
- Personal details may be included based on local norms
- Include language proficiencies prominently`,

		latam: `### REGIONAL FORMAT: Latin America
- ${
			includePhoto
				? "Include professional photo if provided"
				: "Photo often expected"
		}
- Use Spanish/Portuguese conventions if specified
- Include language proficiencies`,

		"middle-east": `### REGIONAL FORMAT: Middle East
- ${
			includePhoto
				? "Include professional photo if provided"
				: "Photo commonly expected"
		}
- Personal details often expected (nationality, visa status)
- Include language proficiencies prominently`,

		international: `### REGIONAL FORMAT: International/Adaptive
- When in doubt, follow US format (most universally accepted)
- Include work authorization/visa status if relevant
- Highlight international experience and language skills`,
	};

	return instructions[region] || instructions.international;
}

/** Builds language-specific instructions */
export function buildLanguageInstructions(language: ResumeLanguage): string {
	if (language === "en") return "";

	const names: Record<ResumeLanguage, string> = {
		en: "English",
		es: "Spanish",
		fr: "French",
		de: "German",
		pt: "Portuguese",
		it: "Italian",
		zh: "Chinese",
		ja: "Japanese",
		ko: "Korean",
		ar: "Arabic",
	};

	const verbs = getActionVerbs(language).slice(0, 8).join(", ");

	return `### LANGUAGE: ${names[language]}
- Generate ALL content in ${names[language]}
- Use action verbs: ${verbs}
- Do NOT mix languages`;
}

/** Formats education section */
export function formatEducationSection(
	education: EducationEntry[],
	options: ResumeGenerationOptions = {}
): string {
	const { isRecentGraduate: recent = false, gpaThreshold = 3.5 } = options;

	return education
		.map((edu) => {
			let text = `- ${edu.degree} in ${edu.field} from ${edu.institution}`;

			if (edu.endDate) {
				const range = edu.startDate
					? `${edu.startDate} - ${edu.endDate}`
					: edu.endDate;
				text += ` (${range})`;
			}

			if (edu.gpa !== undefined) {
				const scale = edu.gpaScale || 4;
				const normalized = (edu.gpa / scale) * 4;
				if (recent || normalized >= gpaThreshold)
					text += ` | GPA: ${edu.gpa}/${scale}`;
			}

			if (edu.honors?.length) text += ` | ${edu.honors.join(", ")}`;

			if (recent && edu.relevantCoursework?.length) {
				text += `\n  Relevant Coursework: ${edu.relevantCoursework.join(", ")}`;
			}

			if (edu.thesis) text += `\n  Thesis: ${edu.thesis}`;

			if (edu.academicProjects?.length) {
				text += "\n  Academic Projects:";
				edu.academicProjects.forEach((p) => {
					text += `\n    • ${p.name}: ${p.description}`;
					if (p.technologies?.length) text += ` (${p.technologies.join(", ")})`;
				});
			}

			return text;
		})
		.join("\n");
}

/** Formats work arrangement */
function formatWorkArrangement(arr?: WorkArrangement): string {
	if (!arr || arr === "onsite") return "";
	return ` (${arr.charAt(0).toUpperCase() + arr.slice(1)})`;
}

/** Formats highlights as bullets */
function formatHighlights(highlights: string[], indent: string): string {
	return highlights.map((h) => `\n${indent}• ${h}`).join("");
}

/** Formats experience section with proper sorting for promotions */
export function formatExperienceSection(experience: ExperienceEntry[]): string {
	const grouped = new Map<string, ExperienceEntry[]>();

	experience.forEach((exp) => {
		const existing = grouped.get(exp.company) || [];
		existing.push(exp);
		grouped.set(exp.company, existing);
	});

	let result = "";

	grouped.forEach((roles, company) => {
		const sorted = [...roles].sort(
			(a, b) =>
				(safeDateParse(a.startDate) ?? 0) - (safeDateParse(b.startDate) ?? 0)
		);

		if (sorted.length > 1) {
			const earliest = sorted[0];
			const latest = sorted[sorted.length - 1];
			result += `\n**${company}** (${earliest.startDate} - ${
				latest.endDate || "Present"
			})`;

			[...sorted].reverse().forEach((role) => {
				const arr = formatWorkArrangement(role.workArrangement);
				const loc = role.location ? ` | ${role.location}` : "";
				result += `\n  → **${role.title}**${arr}${loc} (${role.startDate} - ${
					role.endDate || "Present"
				})`;
				result += formatHighlights(role.highlights, "    ");

				if (role.previousTitles?.length) {
					role.previousTitles.forEach((p) => {
						result += `\n    → Previously: **${p.title}** (${p.startDate} - ${p.endDate})`;
						result += formatHighlights(p.highlights, "      ");
					});
				}
			});
		} else {
			const role = sorted[0];
			const arr = formatWorkArrangement(role.workArrangement);
			const loc = role.location ? ` | ${role.location}` : "";
			result += `\n- **${role.title}**${arr} at ${company}${loc} (${
				role.startDate
			} - ${role.endDate || "Present"})`;
			result += formatHighlights(role.highlights, "  ");

			if (role.previousTitles?.length) {
				role.previousTitles.forEach((p) => {
					result += `\n  → Previously: **${p.title}** (${p.startDate} - ${p.endDate})`;
					result += formatHighlights(p.highlights, "    ");
				});
			}
		}
	});

	return result;
}

/** Formats international details */
export function formatInternationalDetails(
	details: InternationalDetails | undefined,
	region: ResumeRegion
): string {
	if (!details) return "";
	const parts: string[] = [];

	if (details.workAuthorization)
		parts.push(`Work Authorization: ${details.workAuthorization}`);
	if (details.languages?.length)
		parts.push(
			`Languages: ${details.languages
				.map((l) => `${l.language} (${l.proficiency})`)
				.join(", ")}`
		);
	if (region !== "us" && details.nationality)
		parts.push(`Nationality: ${details.nationality}`);
	if (details.willingToRelocate !== undefined)
		parts.push(
			`Willing to Relocate: ${details.willingToRelocate ? "Yes" : "No"}`
		);
	if (details.availableFrom)
		parts.push(`Available From: ${details.availableFrom}`);
	if (details.noticePeriod)
		parts.push(`Notice Period: ${details.noticePeriod}`);

	return parts.length
		? `\n**Additional Information:** ${parts.join(" | ")}`
		: "";
}

/** Formats custom sections */
function formatCustomSections(sections?: CustomSection[]): string {
	if (!sections?.length) return "";
	return sections
		.map((s) => {
			const entries = s.entries
				.map((e) => `- **${e.title}**: ${e.description}`)
				.join("\n");
			return `\n**${s.title}:**\n${entries}`;
		})
		.join("\n");
}

/** Builds custom highlights JSON schema */
export function buildCustomHighlightsSchema(names: string[]): string {
	if (!names?.length) return "";
	const sections = names
		.map(
			(n) =>
				`    "${escapeJsonString(
					n
				)}": ["Optimized bullet 1...", "Optimized bullet 2..."]`
		)
		.join(",\n");

	return `,
  "customSectionHighlights": {
${sections}
  }`;
}

/** Builds explanation JSON (recruiter audit mode) */
export function buildExplanationJson(includeExplanations: boolean): string {
	if (!includeExplanations) return "";

	return `,
  "transformationNotes": {
    "keywordIntegration": [
      { "keyword": "keyword from JD", "placedIn": "summary|bullet|skills", "context": "quote showing usage" }
    ],
    "bulletTransformations": [
      { "role": "Company - Title", "original": "...", "optimized": "...", "changes": ["duty→achievement", "keyword inserted"] }
    ],
    "metricsAudit": {
      "preserved": ["Metrics from input that were retained"],
      "qualitative": ["Impact statements used when no metric existed"],
      "fabricated": []
    },
    "relevanceReordering": { "summary": "How bullets were prioritized", "examples": ["..."] },
    "skillsAlignment": { "promoted": ["..."], "demoted": ["..."], "rationale": "..." },
    "gaps": { "missingKeywords": ["JD keywords not in profile"], "suggestions": ["Recommendations"] }
  }`;
}

// ============================================================================
// MAIN PROMPT BUILDERS
// ============================================================================

/**
 * Builds the complete Harvard-style resume optimization prompt
 * Returns STRICT JSON with keywords, coverage, skill evidence, constraints matching
 */
export function buildResumePrompt(
	profile: ResumeProfile,
	jobDescription: string,
	jobTitle: string,
	companyName: string,
	options: ResumeGenerationOptions = {}
): string {
	const {
		region = "us",
		language = "en",
		includePhoto = false,
		includeExplanations = false,
		isRecentGraduate: recent = false,
		gpaThreshold = 3.5,
		maxPages = 1,
	} = options;

	const regionalInstr = buildRegionalInstructions(region, includePhoto);
	const langInstr = buildLanguageInstructions(language);

	const eduSection = formatEducationSection(profile.education, {
		isRecentGraduate: recent,
		gpaThreshold,
	});

	const expSection = formatExperienceSection(profile.experience);
	const intlSection = formatInternationalDetails(
		profile.internationalDetails,
		region
	);
	const customText = formatCustomSections(profile.customSections);
	const customNames = profile.customSections?.map((s) => s.title) || [];

	const actionVerbs = getActionVerbs(language).slice(0, 12).join(", ");

	const certs = profile.certifications?.length
		? `\n**Certifications:** ${profile.certifications.join(", ")}`
		: "";

	const contact = [
		profile.email && `Email: ${profile.email}`,
		profile.phone && `Phone: ${profile.phone}`,
		profile.location && `Location: ${profile.location}`,
		profile.linkedIn && `LinkedIn: ${profile.linkedIn}`,
		profile.portfolio && `Portfolio: ${profile.portfolio}`,
	]
		.filter(Boolean)
		.join(" | ");

	return `
## STEP 1: JOB DESCRIPTION ANALYSIS (DO THIS FIRST)

Extract ATS keywords into:
- mustHave, goodToHave, toolsTech, process, domain, softSkills, responsibilities
- constraints: location + noticePeriod (if JD specifies)
- prioritized: 8–12 ranked keywords (exact spelling from JD)
- jobTitleFromJD: use text after "Job Title:" if present; else use Position input

---

## CANDIDATE PROFILE

**Name:** ${profile.name}
${contact ? `**Contact:** ${contact}\n` : ""}${
		profile.headline ? `**Current Title:** ${profile.headline}\n` : ""
	}${profile.summary ? `**Summary:** ${profile.summary}\n` : ""}${intlSection}

**Work Experience:**
${expSection}

**Education:**
${eduSection}

**Skills (raw):** ${profile.skills.join(", ")}${certs}
${customText}

---

## TARGET JOB

**Position (Input):** ${jobTitle}
**Company:** ${companyName}

**Job Description:**
${jobDescription}

---

${regionalInstr}
${langInstr}

---

## OUTPUT (STRICT JSON ONLY)

Return a JSON object with EXACTLY this structure:

{
  "extractedKeywords": ["keyword1", "keyword2", "keyword3", "...(8-12 critical ATS keywords from JD, exact spelling)"],
  "label": "TARGET job title from JD + 2-3 relevant keywords (e.g., 'Frontend Web Developer | JavaScript, React, CSS')",
  "summary": "REWRITE summary: Start with TARGET JOB TITLE (not candidate's current title); 2-3 sentences; weave in 3-4 extractedKeywords; no fabricated metrics",
  "workHighlights": {
    "Company Name": [
      "Optimized bullet 1: action verb + what + impact (10-15 words, include keyword if truthful)",
      "Optimized bullet 2: action verb + what + impact (10-15 words)",
      "Optimized bullet 3: action verb + what + impact (10-15 words)"
    ]
  },
  "skillsOrdered": ["Skill1", "Skill2", "Skill3"],
  "customSectionHighlights": {
    "Projects": [
      "Optimized project bullet 1",
      "Optimized project bullet 2"
    ]
  }
}

---

## RULES

BULLET FORMULA (MANDATORY):
[Action Verb] + [What] + [Impact] (+ metric ONLY if present in input)

ACTION VERBS: ${actionVerbs}

LENGTH: Target ${maxPages} page(s); 10-15 words per bullet.

EXTRACTED KEYWORDS (CRITICAL - DO THIS FIRST):
- Extract 8-12 most important ATS keywords from the job description
- Include: required skills, tools, technologies, methodologies, soft skills
- Use EXACT spelling from JD (e.g., "Node.js" not "NodeJS")
- These keywords MUST appear in summary, bullets, and skills where truthful

WORKHIGHLIGHTS FORMAT (CRITICAL):
- Keys MUST be exactly the "Company Name" only (NOT "Company - Title")
- Use the exact company name from the candidate profile
- Each key maps to an array of 3-5 optimized bullet strings
- Weave 1-2 extractedKeywords into each company's bullets (only if truthful)
- Reorder bullets so most job-relevant come first

SKILLS ORDERING:
- Only include skills that are proven in experience/projects/certs
- Order by relevance to the job description
- Include 8-15 most relevant skills

CUSTOM SECTIONS:
- If candidate has custom sections (e.g., Projects), include customSectionHighlights
- Keys must match the section titles from the profile${
		customNames.length > 0 ? `: ${customNames.join(", ")}` : ""
	}
- Optimize descriptions with action verbs and impact

METRIC TRUTH (NON-NEGOTIABLE):
- NEVER invent numbers, %, $, team sizes, time saved
- Only preserve metrics that exist in input
- Use qualitative impact language when no metric exists

KEYWORD INTEGRATION:
- Use 3-4 keywords from JD in summary
- Use 1-2 keywords per experience entry (where truthful)
- Mirror exact spelling from job description

SUMMARY REWRITE (CRITICAL):
- The summary MUST start with the TARGET JOB TITLE from the job description
- Do NOT use the candidate's current title (e.g., if applying for "Frontend Developer", don't say "UI/UX Developer")
- Example: If JD is for "Frontend Web Developer", summary should start: "Frontend Web Developer with X years..."
- Rewrite the entire summary to align with the target role

${
	includeExplanations
		? `EXPLANATION MODE:
- metricsAudit.fabricated MUST be empty array []
- Show 2-3 bulletTransformations examples
- Document keyword placements`
		: ""
}

FINAL VALIDATION:
- Output MUST be valid JSON only (no markdown code blocks, no backticks)
- extractedKeywords contains 8-12 keywords from JD (exact spelling)
- label should reflect the target job title + top keywords
- summary contains 3-4 keywords from extractedKeywords
- workHighlights keys are COMPANY NAMES ONLY (e.g., "Google" not "Google - Software Engineer")
- Each workHighlights entry includes 1-2 keywords where truthful
- No fabricated tools/metrics/claims
- skillsOrdered ordered by JD relevance, contains only provable skills

Return ONLY the raw JSON object, nothing else.
`.trim();
}

/**
 * Builds cover letter prompt following Harvard guidelines
 * Returns plain text cover letter
 */
export interface CoverLetterGenerationOptionsWithKeywords
	extends CoverLetterGenerationOptions {
	extractedKeywords?: string[];
}

export function buildCoverLetterPrompt(
	profile: CoverLetterProfile,
	jobDescription: string,
	jobTitle: string,
	companyName: string,
	recruiterName?: string,
	options: CoverLetterGenerationOptionsWithKeywords = {}
): string {
	const {
		language = "en",
		includeExplanations = false,
		extractedKeywords = [],
	} = options;

	const greeting = recruiterName
		? `Dear ${recruiterName}`
		: "Dear Hiring Manager";
	const langInstr = buildLanguageInstructions(language);

	const workAuth = profile.internationalDetails?.workAuthorization
		? `\n**Work Authorization:** ${profile.internationalDetails.workAuthorization}`
		: "";

	const langs = profile.internationalDetails?.languages?.length
		? `\n**Languages:** ${profile.internationalDetails.languages
				.map((l) => `${l.language} (${l.proficiency})`)
				.join(", ")}`
		: "";

	const keywordsSection =
		extractedKeywords.length > 0
			? `\n\n## KEYWORDS TO INTEGRATE (from resume analysis)\n\nUse these exact terms where truthful: ${extractedKeywords.join(
					", "
			  )}\n\nYou MUST naturally weave 4-6 of these keywords into the cover letter.`
			: "";

	const explainSection = includeExplanations
		? `

---

After the letter, provide:
---EXPLANATION START---
**Keywords Integrated:** [list]
**Evidence Matches:** [which requirements addressed with which examples]
**Company Research Demonstrated:** [how shown]
---EXPLANATION END---`
		: "";

	return `
## ANALYZE JOB POSTING

Identify: Top 3 requirements, Company keywords, Success metrics${keywordsSection}

---

## CANDIDATE

**Name:** ${profile.name}
${profile.headline ? `**Role:** ${profile.headline}` : ""}
${
	profile.summary ? `**Background:** ${profile.summary}` : ""
}${workAuth}${langs}

**Key Achievements:**
${profile.topExperiences.map((e) => `- ${e}`).join("\n")}

**Skills:** ${profile.skills.slice(0, 8).join(", ")}

---

## TARGET

**Role:** ${jobTitle}
**Company:** ${companyName}

**Job Description:**
${jobDescription}

---
${langInstr}

## WRITE COVER LETTER

Start with "${greeting},"

**Opening (2-3 sentences):**
- Hook about ${companyName} (NOT "I am writing to apply...")
- State role: "${jobTitle}"
- Your value proposition

**Body 1 (3-4 sentences):**
- Evidence for most important requirement
- Specific example with metric/outcome (only if true)

**Body 2 (3-4 sentences):**
- Second evidence example
- Why ${companyName} specifically (mission, values, product)

**Closing (2-3 sentences):**
- Confident summary
- "I would welcome the opportunity to discuss..."
- "Thank you for considering my application."

Best regards,
${profile.name}

---

## RULES

- KEYWORD INTEGRATION: Use 4-6 keywords from the provided list (exact spelling)
- READER-CENTRIC: Every sentence shows what you deliver FOR THEM
- "I" CONTROL: Max 2 sentences starting with "I" per paragraph
- EVIDENCE: Back every skill claim with specific example
- THEIR LANGUAGE: Mirror exact JD phrases and keywords
- CONFIDENCE: Not arrogant, not desperate
- LENGTH: Under 350 words
- TRUTHFULNESS: Never invent metrics, tools, or experiences

Return ONLY the cover letter text (no JSON, no markdown).${explainSection}
`.trim();
}

// ============================================================================
// CONVENIENCE EXPORT (optional)
// ============================================================================

export default {
	RESUME_SYSTEM_PROMPT,
	COVER_LETTER_SYSTEM_PROMPT,

	buildResumePrompt,
	buildCoverLetterPrompt,
	buildKeywordExtractionPrompt,

	getActionVerbs,
	getGpaThreshold,
	isRecentGraduate,

	buildRegionalInstructions,
	buildLanguageInstructions,
	formatEducationSection,
	formatExperienceSection,
	formatInternationalDetails,
	buildCustomHighlightsSchema,
	buildExplanationJson,

	ACTION_VERBS,
};
