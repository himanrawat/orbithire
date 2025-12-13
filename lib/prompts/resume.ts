/**
 * AI prompt templates for Harvard-style ATS-friendly resume and cover letter generation
 * Based on Harvard Office of Career Services guidelines
 *
 * Enhanced with:
 * - International resume considerations
 * - GPA and academic details support
 * - Multiple roles per company handling
 * - Multilingual support
 * - Recruiter-side explanation features
 * - Modular architecture
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Regional resume format preferences
 * Different regions have varying conventions for resume content
 */
export type ResumeRegion =
	| "us" // Standard US format (no photo, no personal details)
	| "uk" // Similar to US but may include nationality for work rights
	| "eu" // May include photo, nationality, sometimes DOB
	| "asia" // Often includes photo, personal details, may be longer
	| "latam" // Similar to EU conventions
	| "middle-east" // May include photo, nationality, religion
	| "international"; // Adaptive format based on job location

/**
 * Language codes for multilingual resume generation
 */
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

/**
 * Work arrangement type
 */
export type WorkArrangement = "onsite" | "remote" | "hybrid";

/**
 * Enhanced education entry with GPA and academic details
 */
export interface EducationEntry {
	institution: string;
	degree: string;
	field: string;
	startDate?: string;
	endDate?: string;
	gpa?: number;
	gpaScale?: number; // e.g., 4.0, 5.0, 10.0
	honors?: string[]; // e.g., ["Cum Laude", "Dean's List", "Phi Beta Kappa"]
	relevantCoursework?: string[];
	thesis?: string;
	academicProjects?: Array<{
		name: string;
		description: string;
		technologies?: string[];
	}>;
}

/**
 * Enhanced experience entry supporting multiple roles and work arrangements
 */
export interface ExperienceEntry {
	company: string;
	title: string;
	startDate: string;
	endDate?: string;
	location?: string;
	workArrangement?: WorkArrangement;
	highlights: string[];
	// For promotions/multiple roles at same company
	previousTitles?: Array<{
		title: string;
		startDate: string;
		endDate: string;
		highlights: string[];
	}>;
}

/**
 * International/personal details (for non-US formats)
 */
export interface InternationalDetails {
	nationality?: string;
	workAuthorization?: string; // e.g., "US Citizen", "H1B Visa", "EU Work Permit"
	languages?: Array<{
		language: string;
		proficiency: "native" | "fluent" | "professional" | "intermediate" | "basic";
	}>;
	willingToRelocate?: boolean;
	availableFrom?: string;
}

/**
 * Custom section entry
 */
export interface CustomSectionEntry {
	title: string;
	description: string;
	date?: string;
	url?: string;
}

/**
 * Custom section
 */
export interface CustomSection {
	title: string;
	entries: CustomSectionEntry[];
}

/**
 * Complete profile schema with all enhancements
 */
export interface ResumeProfile {
	name: string;
	headline?: string;
	summary?: string;
	email?: string;
	phone?: string;
	location?: string;
	linkedIn?: string;
	portfolio?: string;
	profilePhotoUrl?: string; // For international formats that include photos

	experience: ExperienceEntry[];
	education: EducationEntry[];
	skills: string[];
	certifications?: string[];
	customSections?: CustomSection[];
	internationalDetails?: InternationalDetails;
}

/**
 * Options for resume generation
 */
export interface ResumeGenerationOptions {
	region?: ResumeRegion;
	language?: ResumeLanguage;
	includePhoto?: boolean;
	includeExplanations?: boolean; // For recruiter-side audit trail
	maxPages?: 1 | 2;
	isRecentGraduate?: boolean; // Affects GPA inclusion threshold
	gpaThreshold?: number; // Minimum GPA to include (default: 3.5 for 4.0 scale)
}

/**
 * Cover letter profile (simplified for cover letters)
 */
export interface CoverLetterProfile {
	name: string;
	headline?: string;
	summary?: string;
	topExperiences: string[];
	skills: string[];
	internationalDetails?: InternationalDetails;
}

/**
 * Options for cover letter generation
 */
export interface CoverLetterGenerationOptions {
	language?: ResumeLanguage;
	includeExplanations?: boolean;
}

// ============================================================================
// ACTION VERBS BY LANGUAGE (for multilingual support)
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

export const RESUME_SYSTEM_PROMPT = `You are an expert resume optimization specialist following Harvard Office of Career Services standards. Your job is to transform candidate profiles into powerful, results-driven resumes tailored specifically for each job description.

## HARVARD RESUME PRINCIPLES:

### 1. RESULTS OVER DUTIES (Critical)
- Every bullet must show IMPACT and ACHIEVEMENT, never just responsibilities
- BAD: "Responsible for managing social media accounts"
- GOOD: "Grew Instagram following by 45% (2K to 2.9K) in 3 months through targeted content strategy"
- Transform every duty into a quantified accomplishment

### 2. KEYWORD INTEGRATION
- Extract 5-10 critical keywords/phrases from the job description
- Weave these EXACT terms naturally into bullets and summary
- Front-load keywords in bullet points for ATS scanning
- Match job title terminology precisely

### 3. ACTION VERBS FIRST
- Start EVERY bullet with a strong action verb (Led, Architected, Spearheaded, Optimized, Delivered)
- Never start with dates, "I", or passive constructions
- Use present tense for current roles, past tense for previous roles

### 4. QUANTIFY EVERYTHING
- Include metrics: percentages, dollar amounts, team sizes, timeframes
- If exact numbers unknown, use reasonable estimates based on context
- Examples: "Managed $50K budget", "Led team of 5", "Reduced processing time by 30%"

### 5. NO PERSONAL PRONOUNS
- Never use "I", "me", "my", "we", "our" in bullet points
- Write in implied first person (subject understood)

### 6. CONCISE & SCANNABLE
- Each bullet: 10-15 words maximum
- Employers scan resumes in 6-7 seconds - make every word count
- Remove filler words: "various", "helped with", "assisted in"

### 7. TAILORED TO THIS SPECIFIC ROLE
- Prioritize experiences that directly match job requirements
- Reorder bullets within each role to lead with most relevant
- Emphasize transferable skills that map to their needs

Your output must be:
- Truthful (never fabricate - enhance and reframe what exists)
- Results-focused (achievements with metrics, not duties)
- Keyword-rich (incorporating job posting language)
- Concise (impactful, scannable bullets)
- ATS-optimized (clean formatting, standard sections)`;

export const COVER_LETTER_SYSTEM_PROMPT = `You are an expert career coach following Harvard Office of Career Services standards for cover letters. Your letters serve as both a writing sample and a compelling argument for why this candidate is the ideal fit.

## HARVARD COVER LETTER PRINCIPLES:

### 1. READER-CENTRIC FOCUS (Critical)
- The hiring manager thinks: "How can this person help OUR organization?"
- Focus on what you can do FOR THEM, not what you want from them
- Every paragraph must answer: "Why should we hire YOU for THIS position?"

### 2. AVOID "I" OVERLOAD
- Do NOT start every sentence with "I"
- Vary sentence structure: "My experience in...", "During my tenure...", "This role excites me because..."
- Balance self-promotion with company-focused language

### 3. EVIDENCE-BASED CLAIMS
- Never just claim a skill - PROVE it with a specific example
- BAD: "I have strong leadership skills"
- GOOD: "As Project Lead at XYZ, I guided a team of 6 engineers to deliver a product 2 weeks ahead of schedule, resulting in $30K cost savings"
- Include 2-3 specific, quantified examples that match job requirements

### 4. USE THEIR LANGUAGE
- Mirror keywords and phrases from the job posting
- Reference specific aspects of their mission, values, or recent work
- Show you've researched THIS company, not just the role

### 5. STRUCTURE (3-4 paragraphs, under 350 words)
- Opening: Hook + specific position + why THIS company + your value proposition
- Body 1-2: 2-3 evidence-backed examples proving you meet their key requirements
- Closing: Enthusiasm + confidence + call to action

### 6. PROFESSIONAL BUT CONFIDENT
- Avoid overly formal/flowery language - clear and direct
- No negative comments about past employers
- Express genuine enthusiasm without being sycophantic
- End with confidence: "I would welcome the opportunity to discuss..." not "I hope to hear from you"

Your output must be:
- Reader-centric (focused on their needs)
- Evidence-based (specific examples with metrics)
- Keyword-aligned (using job posting language)
- Concise (3-4 paragraphs, under 350 words)
- Professionally confident (not desperate or arrogant)`;

// ============================================================================
// MODULAR HELPER FUNCTIONS
// ============================================================================

/**
 * Builds a standalone keyword extraction prompt
 * Can be used independently or as part of the resume generation pipeline
 */
export function buildKeywordExtractionPrompt(jobDescription: string): string {
	return `Analyze the following job description and extract critical keywords for ATS optimization.

## JOB DESCRIPTION:
${jobDescription}

## YOUR TASK:
Extract and categorize keywords from this job posting:

{
  "mustHaveSkills": ["Technical skills, tools, or certifications explicitly required"],
  "keyResponsibilities": ["Core duties and deliverables mentioned"],
  "softSkills": ["Leadership qualities, work style, cultural fit indicators"],
  "industryTerms": ["Specific terminology, jargon, or domain knowledge"],
  "toolsAndTechnologies": ["Software, platforms, frameworks mentioned"],
  "prioritizedKeywords": ["Top 8-12 keywords ranked by importance for ATS matching"]
}

Return ONLY the JSON object, no markdown code blocks.`;
}

/**
 * Builds regional-specific instructions based on target region
 */
export function buildRegionalInstructions(
	region: ResumeRegion,
	includePhoto: boolean = false
): string {
	const instructions: Record<ResumeRegion, string> = {
		us: `
### REGIONAL FORMAT: United States
- Do NOT include photo, age, marital status, or nationality
- Keep to 1 page (2 pages only for senior roles with 10+ years experience)
- Work authorization should only be mentioned if specifically requested
- Focus on achievements and metrics over personal details`,

		uk: `
### REGIONAL FORMAT: United Kingdom
- Do NOT include photo, age, or marital status
- May include nationality/work rights if relevant for visa requirements
- Keep to 1-2 pages
- Use British English spelling (colour, organisation, programme)`,

		eu: `
### REGIONAL FORMAT: European Union
- ${includePhoto ? "Include professional photo if provided" : "Photo optional based on country norms"}
- May include nationality for work authorization clarity
- CV format acceptable (can be 2+ pages for senior roles)
- Include language proficiencies prominently
- Consider Europass format compatibility if requested`,

		asia: `
### REGIONAL FORMAT: Asia
- ${includePhoto ? "Include professional photo if provided" : "Photo commonly expected in many Asian countries"}
- Personal details (DOB, nationality) may be included based on local norms
- CV format with comprehensive detail is acceptable
- Include language proficiencies prominently
- Adapt formality level to cultural expectations`,

		latam: `
### REGIONAL FORMAT: Latin America
- ${includePhoto ? "Include professional photo if provided" : "Photo often expected"}
- Personal details may be included based on country norms
- CV format acceptable
- Use Spanish/Portuguese language conventions if specified
- Include language proficiencies`,

		"middle-east": `
### REGIONAL FORMAT: Middle East
- ${includePhoto ? "Include professional photo if provided" : "Photo commonly expected"}
- Personal details often expected (nationality, visa status)
- CV format with comprehensive detail
- Include language proficiencies prominently`,

		international: `
### REGIONAL FORMAT: International/Adaptive
- Adapt format to the job location's conventions
- When in doubt, follow US format (most universally accepted)
- Include work authorization/visa status if relevant
- Highlight international experience and language skills
- Quantified achievements and active language are universal positives`,
	};

	return instructions[region] || instructions.international;
}

/**
 * Formats education section with GPA and academic details
 */
export function formatEducationSection(
	education: EducationEntry[],
	options: ResumeGenerationOptions = {}
): string {
	const { isRecentGraduate = false, gpaThreshold = 3.5 } = options;

	return education
		.map((edu) => {
			let eduText = `- ${edu.degree} in ${edu.field} from ${edu.institution}`;

			if (edu.endDate) {
				const dateRange = edu.startDate ? `${edu.startDate} - ${edu.endDate}` : edu.endDate;
				eduText += ` (${dateRange})`;
			}

			// Include GPA if above threshold
			if (edu.gpa !== undefined) {
				const scale = edu.gpaScale || 4;
				const normalizedGpa = (edu.gpa / scale) * 4; // Normalize to 4.0 scale
				const shouldIncludeGpa =
					isRecentGraduate || normalizedGpa >= gpaThreshold;

				if (shouldIncludeGpa) {
					eduText += ` | GPA: ${edu.gpa}/${scale}`;
				}
			}

			// Include honors
			if (edu.honors && edu.honors.length > 0) {
				eduText += ` | ${edu.honors.join(", ")}`;
			}

			// Include relevant coursework for recent graduates
			if (
				isRecentGraduate &&
				edu.relevantCoursework &&
				edu.relevantCoursework.length > 0
			) {
				eduText += `\n  Relevant Coursework: ${edu.relevantCoursework.join(", ")}`;
			}

			// Include thesis if present
			if (edu.thesis) {
				eduText += `\n  Thesis: ${edu.thesis}`;
			}

			// Include academic projects
			if (edu.academicProjects && edu.academicProjects.length > 0) {
				eduText += "\n  Academic Projects:";
				edu.academicProjects.forEach((project) => {
					eduText += `\n    • ${project.name}: ${project.description}`;
					if (project.technologies && project.technologies.length > 0) {
						eduText += ` (${project.technologies.join(", ")})`;
					}
				});
			}

			return eduText;
		})
		.join("\n");
}

/**
 * Formats work arrangement display text
 */
function formatWorkArrangement(arrangement?: WorkArrangement): string {
	if (!arrangement || arrangement === "onsite") return "";
	return ` (${arrangement.charAt(0).toUpperCase() + arrangement.slice(1)})`;
}

/**
 * Formats highlights as bullet points
 */
function formatHighlights(highlights: string[], indent: string): string {
	return highlights.map((h) => `\n${indent}• ${h}`).join("");
}

/**
 * Formats previous titles within a role
 */
function formatPreviousTitles(
	previousTitles: Array<{ title: string; startDate: string; endDate: string; highlights: string[] }>,
	isNested: boolean
): string {
	const prefix = isNested ? "  → " : "  → Previously: ";
	const indent = "    ";
	return previousTitles
		.map((prev) => {
			return `\n${prefix}**${prev.title}** (${prev.startDate} - ${prev.endDate})${formatHighlights(prev.highlights, indent)}`;
		})
		.join("");
}

/**
 * Formats experience section handling multiple roles at same company
 */
export function formatExperienceSection(experience: ExperienceEntry[]): string {
	// Group experiences by company for better handling of promotions
	const groupedByCompany = new Map<string, ExperienceEntry[]>();

	experience.forEach((exp) => {
		const existing = groupedByCompany.get(exp.company) || [];
		existing.push(exp);
		groupedByCompany.set(exp.company, existing);
	});

	let result = "";

	// Process each company group
	groupedByCompany.forEach((roles, company) => {
		if (roles.length > 1) {
			// Multiple roles at same company - show as promotion track
			const earliestRole = roles.at(-1);
			const latestRole = roles[0];
			result += `\n**${company}** (${earliestRole?.startDate} - ${latestRole.endDate || "Present"})`;

			roles.forEach((role) => {
				const arrangement = formatWorkArrangement(role.workArrangement);
				const location = role.location ? ` | ${role.location}` : "";
				result += `\n  → **${role.title}**${arrangement}${location} (${role.startDate} - ${role.endDate || "Present"})`;
				result += formatHighlights(role.highlights, "    ");

				if (role.previousTitles && role.previousTitles.length > 0) {
					result += formatPreviousTitles(role.previousTitles, true);
				}
			});
		} else {
			// Single role at company
			const role = roles[0];
			const arrangement = formatWorkArrangement(role.workArrangement);
			const location = role.location ? ` | ${role.location}` : "";

			result += `\n- **${role.title}**${arrangement} at ${company}${location} (${role.startDate} - ${role.endDate || "Present"})`;
			result += formatHighlights(role.highlights, "  ");

			if (role.previousTitles && role.previousTitles.length > 0) {
				result += formatPreviousTitles(role.previousTitles, false);
			}
		}
	});

	return result;
}

/**
 * Formats international details section
 */
export function formatInternationalDetails(
	details: InternationalDetails | undefined,
	region: ResumeRegion
): string {
	if (!details) return "";

	const parts: string[] = [];

	// Work authorization is important for most regions
	if (details.workAuthorization) {
		parts.push(`Work Authorization: ${details.workAuthorization}`);
	}

	// Languages are always valuable to include
	if (details.languages && details.languages.length > 0) {
		const languageList = details.languages
			.map((l) => `${l.language} (${l.proficiency})`)
			.join(", ");
		parts.push(`Languages: ${languageList}`);
	}

	// Nationality for non-US regions
	if (region !== "us" && details.nationality) {
		parts.push(`Nationality: ${details.nationality}`);
	}

	// Relocation and availability
	if (details.willingToRelocate !== undefined) {
		parts.push(
			`Willing to Relocate: ${details.willingToRelocate ? "Yes" : "No"}`
		);
	}

	if (details.availableFrom) {
		parts.push(`Available From: ${details.availableFrom}`);
	}

	return parts.length > 0 ? `\n**Additional Information:** ${parts.join(" | ")}` : "";
}

/**
 * Builds language-specific instructions
 */
export function buildLanguageInstructions(language: ResumeLanguage): string {
	if (language === "en") return "";

	const languageNames: Record<ResumeLanguage, string> = {
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

	const verbs = ACTION_VERBS[language].slice(0, 8).join(", ");

	return `
### LANGUAGE REQUIREMENT: ${languageNames[language]}
- Generate ALL content in ${languageNames[language]}
- Use ${languageNames[language]} action verbs such as: ${verbs}
- Follow ${languageNames[language]} resume conventions and formality level
- Maintain Harvard principles (results-focus, quantification) in ${languageNames[language]}
- Do NOT mix languages - output must be entirely in ${languageNames[language]}`;
}

/**
 * Builds explanation/audit trail instructions
 */
export function buildExplanationInstructions(): string {
	return `
### EXPLANATION MODE (Recruiter Audit Trail)
In addition to the optimized resume, provide a "transformationNotes" object explaining your changes:

"transformationNotes": {
  "keywordIntegration": ["List of keywords from JD that were incorporated and where"],
  "bulletTransformations": [
    {
      "original": "Original bullet text",
      "optimized": "Transformed bullet text",
      "rationale": "Why this change improves ATS compatibility and impact"
    }
  ],
  "relevanceReordering": "Explanation of how bullets were prioritized for this role",
  "metricsAdded": ["List of quantified metrics added with reasoning"],
  "skillsAlignment": "How skills were reordered to match JD priorities"
}`;
}

/**
 * Formats custom sections for the prompt
 */
function formatCustomSections(customSections?: CustomSection[]): string {
	if (!customSections || customSections.length === 0) return "";

	return customSections
		.map((section) => {
			const entries = section.entries
				.map((entry) => `- **${entry.title}**: ${entry.description}`)
				.join("\n");
			return `\n**${section.title}:**\n${entries}`;
		})
		.join("\n");
}

/**
 * Builds custom highlights JSON example for the prompt
 */
function buildCustomHighlightsJson(sectionNames: string[]): string {
	if (sectionNames.length === 0) return "";

	const examples = sectionNames
		.map((name) => `    "${name}": ["Optimized bullet 1...", "Optimized bullet 2..."]`)
		.join(",\n");

	return `,
  "customSectionHighlights": {
${examples}
  }`;
}

/**
 * Builds explanation JSON example for the prompt
 */
function buildExplanationJson(includeExplanations: boolean): string {
	if (!includeExplanations) return "";

	return `,
  "transformationNotes": {
    "keywordIntegration": ["keyword1 → used in summary", "keyword2 → used in bullet for Company X"],
    "bulletTransformations": [{"original": "...", "optimized": "...", "rationale": "..."}],
    "relevanceReordering": "Prioritized X experience because...",
    "metricsAdded": ["Added 30% metric to X based on context"],
    "skillsAlignment": "Reordered to lead with skills matching JD requirements"
  }`;
}

/**
 * Builds dynamic transformation rules based on options
 */
function buildDynamicRules(
	isRecentGraduate: boolean,
	customSectionNames: string[],
	includeExplanations: boolean
): string {
	const rules: string[] = [];
	let ruleNumber = 12;

	if (isRecentGraduate) {
		rules.push(
			`${ruleNumber}. **Recent graduate emphasis** - Highlight education, academic projects, relevant coursework, and GPA prominently`
		);
		ruleNumber++;
	}

	if (customSectionNames.length > 0) {
		rules.push(
			`${ruleNumber}. **Custom sections** (${customSectionNames.join(", ")}): Rewrite entries to highlight direct relevance to job requirements`
		);
		ruleNumber++;
	}

	if (includeExplanations) {
		rules.push(
			`${ruleNumber}. **Include transformation notes** - Explain each major change for recruiter audit trail`
		);
	}

	return rules.join("\n");
}

// ============================================================================
// MAIN PROMPT BUILDERS
// ============================================================================

/**
 * Builds the complete resume optimization prompt with all enhancements
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
		isRecentGraduate = false,
		gpaThreshold = 3.5,
	} = options;

	// Build modular sections
	const regionalInstructions = buildRegionalInstructions(region, includePhoto);
	const languageInstructions = buildLanguageInstructions(language);

	// Format profile sections
	const educationSection = formatEducationSection(profile.education, {
		isRecentGraduate,
		gpaThreshold,
	});
	const experienceSection = formatExperienceSection(profile.experience);
	const internationalSection = formatInternationalDetails(
		profile.internationalDetails,
		region
	);

	// Build custom sections content using helper functions
	const customSectionsText = formatCustomSections(profile.customSections);
	const customSectionNames = profile.customSections?.map((s) => s.title) || [];
	const customHighlightsExample = buildCustomHighlightsJson(customSectionNames);
	const explanationJsonExample = buildExplanationJson(includeExplanations);
	const dynamicRules = buildDynamicRules(isRecentGraduate, customSectionNames, includeExplanations);

	// Localized action verbs for instructions
	const actionVerbs = ACTION_VERBS[language].slice(0, 12).join(", ");

	return `
## STEP 1: KEYWORD EXTRACTION (Do this first!)

Analyze the job description below and identify:
- **Must-have skills:** Technical skills, tools, or certifications explicitly required
- **Key responsibilities:** Core duties they need someone to perform
- **Soft skills/values:** Leadership qualities, work style, or cultural fit indicators
- **Industry terms:** Specific terminology or jargon used in the posting

---

## CANDIDATE PROFILE

**Name:** ${profile.name}
${profile.headline ? `**Current Title:** ${profile.headline}` : ""}
${profile.summary ? `**Summary:** ${profile.summary}` : ""}
${profile.location ? `**Location:** ${profile.location}` : ""}
${internationalSection}

**Work Experience:**
${experienceSection}

**Education:**
${educationSection}

**Skills:** ${profile.skills.join(", ")}
${profile.certifications && profile.certifications.length > 0 ? `\n**Certifications:** ${profile.certifications.join(", ")}` : ""}
${customSectionsText}

---

## TARGET JOB

**Position:** ${jobTitle}
**Company:** ${companyName}

**Job Description:**
${jobDescription}

---
${regionalInstructions}
${languageInstructions}

## YOUR TASK (Harvard-Style Resume Optimization)

Generate an optimized resume in JSON format following Harvard OCS principles:

{
  "extractedKeywords": ["keyword1", "keyword2", "..."],
  "label": "Professional headline using job posting terminology (e.g., '${jobTitle} | [Key Skill from JD] Expert')",
  "summary": "2-3 sentence summary that: (1) Opens with years of experience in relevant field, (2) Incorporates 3-4 extracted keywords naturally, (3) Highlights your biggest quantified achievement relevant to this role",
  "workExperience": [
    {
      "company": "Company Name",
      "title": "Job Title",
      "dates": "Start - End",
      "location": "City, State/Country (Remote/Hybrid if applicable)",
      "highlights": ["Result-focused bullet with metric...", "Another achievement..."]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "degree": "Degree",
      "field": "Field of Study",
      "dates": "Graduation Year",
      "gpa": "GPA if above threshold",
      "honors": ["Honor 1", "Honor 2"],
      "relevantCoursework": ["Course 1", "Course 2"]
    }
  ],
  "skillsOrdered": ["Most relevant skill from JD", "Second most relevant", "..."],
  "certifications": ["Relevant cert 1", "..."],
  "additionalInfo": {
    "languages": ["Language (proficiency)"],
    "workAuthorization": "Status if relevant"
  }${customHighlightsExample}${explanationJsonExample}
}

## HARVARD TRANSFORMATION RULES:

### For each work bullet, apply this formula:
**[Action Verb] + [What You Did] + [Result/Impact with Metric]**

Example transformations:
- BEFORE: "Managed social media accounts"
- AFTER: "Grew LinkedIn engagement by 150% through data-driven content strategy, generating 50+ qualified leads monthly"

- BEFORE: "Helped with customer support"
- AFTER: "Resolved 40+ customer inquiries daily with 98% satisfaction rating, reducing escalations by 25%"

### Mandatory requirements:
1. **Extract keywords first** - List 8-12 critical terms from the job description in "extractedKeywords"
2. **Transform duties → achievements** - Every bullet must show RESULT with a metric (%, $, #, time saved)
3. **Use their language** - Incorporate extracted keywords verbatim into bullets and summary
4. **Action verbs only** - Start each bullet with: ${actionVerbs}
5. **No pronouns** - Never use "I", "my", "we" in any bullet
6. **10-15 words per bullet** - Concise and scannable
7. **Prioritize relevance** - Reorder bullets within each role so most job-relevant appear first
8. **Match job title terminology** - If JD says "Software Engineer" don't use "Developer"
9. **TRUTHFUL** - Only enhance what exists; never fabricate experiences or inflate numbers unrealistically
10. **Handle multiple roles** - If candidate held multiple positions at same company, list each with distinct achievements
11. **Remote/Hybrid work** - Include work arrangement indicators when relevant (especially for remote-friendly roles)
${dynamicRules}

Return ONLY the JSON object, no markdown code blocks.`;
}

/**
 * Builds the complete cover letter prompt with enhancements
 */
export function buildCoverLetterPrompt(
	profile: CoverLetterProfile,
	jobDescription: string,
	jobTitle: string,
	companyName: string,
	recruiterName?: string,
	options: CoverLetterGenerationOptions = {}
): string {
	const { language = "en", includeExplanations = false } = options;

	const greeting = recruiterName
		? `Dear ${recruiterName}`
		: "Dear Hiring Manager";

	const languageInstructions = buildLanguageInstructions(language);

	// International details for cover letter
	const internationalNote =
		profile.internationalDetails?.workAuthorization
			? `\n**Work Authorization:** ${profile.internationalDetails.workAuthorization}`
			: "";

	const languagesNote = (() => {
		const languages = profile.internationalDetails?.languages;
		if (!languages || languages.length === 0) return "";
		const formatted = languages.map((l) => `${l.language} (${l.proficiency})`).join(", ");
		return `\n**Languages:** ${formatted}`;
	})();

	const explanationSection = includeExplanations
		? `

---

## EXPLANATION OUTPUT (Optional - for recruiter review)

After the cover letter, provide a brief analysis:

---EXPLANATION START---
**Keywords Integrated:** [List of JD keywords incorporated]
**Evidence Matches:** [Which requirements were addressed with which examples]
**Company Research Demonstrated:** [How company-specific knowledge was shown]
**Tone Calibration:** [How professional confidence was balanced]
---EXPLANATION END---`
		: "";

	return `
## STEP 1: ANALYZE THE JOB POSTING

Before writing, identify from the job description:
- **Top 3 requirements:** The most critical skills/experiences they need
- **Company keywords:** Specific terms, values, or phrases they use
- **What success looks like:** What outcomes are they expecting from this hire?

---

## CANDIDATE PROFILE

**Name:** ${profile.name}
${profile.headline ? `**Current Role:** ${profile.headline}` : ""}
${profile.summary ? `**Background:** ${profile.summary}` : ""}
${internationalNote}
${languagesNote}

**Key Achievements (use these as evidence):**
${profile.topExperiences.map((exp) => `- ${exp}`).join("\n")}

**Core Skills:** ${profile.skills.slice(0, 8).join(", ")}

---

## TARGET POSITION

**Role:** ${jobTitle}
**Company:** ${companyName}

**Job Description:**
${jobDescription}

---
${languageInstructions}

## YOUR TASK (Harvard-Style Cover Letter)

Write a compelling, reader-centric cover letter following Harvard OCS principles.

### STRUCTURE:

**Opening paragraph (2-3 sentences):**
Start with "${greeting},"
- Hook: Open with something specific about ${companyName} that excites you (their mission, recent news, product, or values - show you've researched them)
- State the specific role: "${jobTitle}"
- Your value proposition in ONE sentence: What unique combination of skills/experience do you bring?
- DO NOT start with "I am writing to apply..." - this is generic and weak

**Body paragraph 1 - Evidence Match #1 (3-4 sentences):**
- Identify the MOST important requirement from the job posting
- Provide a SPECIFIC example from your experience that proves you meet it
- Include a quantified result (metric, percentage, outcome)
- Connect explicitly: "This experience directly prepares me to [what they need]..."

**Body paragraph 2 - Evidence Match #2 + Company Fit (3-4 sentences):**
- Address a second key requirement with another specific example
- Weave in WHY ${companyName} specifically: reference their mission, values, culture, or recent work
- Show alignment: how your goals/values match theirs
- Keep focus on what you can CONTRIBUTE to them

**Closing paragraph (2-3 sentences):**
- Summarize your fit in one confident sentence
- Express enthusiasm for contributing to their team
- End with confidence: "I would welcome the opportunity to discuss how my experience in [X] can help ${companyName} achieve [their goal]."
- Thank them: "Thank you for considering my application."

Sign off:
Best regards,
${profile.name}

---

## HARVARD RULES - MUST FOLLOW:

### 1. READER-CENTRIC (The #1 Rule)
- Ask yourself for every sentence: "Does this show what I can do FOR THEM?"
- BAD: "I am looking for a challenging role where I can grow"
- GOOD: "My background in X positions me to help ${companyName} achieve Y"

### 2. AVOID "I" OVERLOAD
- Do NOT start more than 2 sentences with "I" in any paragraph
- Vary openings: "My experience...", "During my time at...", "This role...", "At [Company]...", "Having led..."

### 3. EVIDENCE, NOT CLAIMS
For each skill you mention, immediately back it with a SPECIFIC example:
- BAD: "I have excellent communication skills"
- GOOD: "As team lead, I facilitated weekly cross-functional syncs between engineering and marketing, reducing project delays by 40%"

### 4. USE THEIR LANGUAGE
- Mirror exact phrases from the job description
- If they say "cross-functional collaboration" - use that phrase
- If they mention specific tools - name them

### 5. PROFESSIONAL CONFIDENCE
- Not arrogant: Avoid "I'm the best candidate" or "You won't find anyone better"
- Not desperate: Avoid "I really need this job" or "I hope you'll consider me"
- Just right: "I am confident my experience in X would enable me to contribute meaningfully to your team"

### 6. WORD LIMIT: Under 350 words total

---

Return ONLY the cover letter text, no JSON or markdown formatting.${explanationSection}`;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get recommended GPA threshold based on scale
 */
export function getGpaThreshold(scale: number = 4): number {
	// Normalize to common scales
	const thresholds: Record<number, number> = {
		4: 3.5,
		5: 4.4,
		10: 8.5,
		100: 85,
	};
	return thresholds[scale] || scale * 0.875; // Default to 87.5% of scale
}

/**
 * Determine if candidate qualifies as recent graduate
 * (graduated within last 2 years)
 */
export function isRecentGraduate(education: EducationEntry[]): boolean {
	const twoYearsAgo = new Date();
	twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

	return education.some((edu) => {
		if (!edu.endDate) return true; // Currently enrolled
		const gradDate = new Date(edu.endDate);
		return gradDate >= twoYearsAgo;
	});
}

/**
 * Get action verbs for a specific language
 */
export function getActionVerbs(language: ResumeLanguage = "en"): string[] {
	return ACTION_VERBS[language] || ACTION_VERBS.en;
}
