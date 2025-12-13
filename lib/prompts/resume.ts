/**
 * AI prompt templates for ATS-friendly resume and cover letter generation
 */

export const RESUME_SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) resume optimization specialist. Your job is to take a candidate's profile and tailor it specifically for a job description while maintaining truthfulness and professional standards.

Key ATS optimization principles:
1. Use keywords from the job description naturally throughout
2. Start bullet points with strong action verbs
3. Quantify achievements with metrics where possible
4. Use standard section headings (Experience, Education, Skills)
5. Avoid tables, graphics, or complex formatting
6. Keep formatting simple and consistent
7. Match job title terminology when appropriate
8. Front-load important keywords in bullets

Your output must be:
- Truthful (never fabricate experience or skills)
- Tailored (emphasize relevant experience for THIS specific role)
- Concise (each bullet should be impactful)
- ATS-friendly (parseable by automated systems)`;

export const COVER_LETTER_SYSTEM_PROMPT = `You are an expert career coach specializing in writing compelling cover letters. Your letters are:

1. Personalized - Reference specific company/role details
2. Concise - 3-4 paragraphs, under 400 words
3. Compelling - Strong opening hook, clear value proposition
4. Professional - Appropriate tone for the industry
5. Action-oriented - End with clear next steps

Structure:
- Opening: Hook + specific role/company interest
- Body 1: Your most relevant experience with quantified impact
- Body 2: Why this company specifically (research-based)
- Closing: Enthusiasm + call to action`;

export function buildResumePrompt(
	profile: {
		name: string;
		headline?: string;
		summary?: string;
		experience: Array<{
			company: string;
			title: string;
			startDate: string;
			endDate?: string;
			highlights: string[];
		}>;
		education: Array<{
			institution: string;
			degree: string;
			field: string;
			endDate?: string;
		}>;
		skills: string[];
	},
	jobDescription: string,
	jobTitle: string,
	companyName: string
): string {
	return `
## CANDIDATE PROFILE

**Name:** ${profile.name}
${profile.headline ? `**Current Title:** ${profile.headline}` : ""}
${profile.summary ? `**Summary:** ${profile.summary}` : ""}

**Work Experience:**
${profile.experience
	.map(
		(exp) => `
- **${exp.title}** at ${exp.company} (${exp.startDate} - ${
			exp.endDate || "Present"
		})
  ${exp.highlights.map((h) => `  • ${h}`).join("\n")}
`
	)
	.join("\n")}

**Education:**
${profile.education
	.map((edu) => `- ${edu.degree} in ${edu.field} from ${edu.institution}`)
	.join("\n")}

**Skills:** ${profile.skills.join(", ")}

---

## TARGET JOB

**Position:** ${jobTitle}
**Company:** ${companyName}

**Job Description:**
${jobDescription}

---

## YOUR TASK

Generate an optimized resume in JSON format with the following structure:

{
  "label": "Professional headline tailored for this role (e.g., 'Senior Software Engineer | React & TypeScript Expert')",
  "summary": "2-3 sentence professional summary tailored for this specific role, incorporating key requirements",
  "workHighlights": {
    "Company Name 1": ["Bullet 1 rewritten for relevance...", "Bullet 2..."],
    "Company Name 2": ["Bullet 1...", "Bullet 2..."]
  },
  "skillsOrdered": ["Most relevant skill", "Second most relevant", "..."]
}

Rules:
1. Rewrite work bullets to emphasize skills/experiences mentioned in the job description
2. Use strong action verbs (Led, Architected, Implemented, Optimized, etc.)
3. Add metrics where plausible based on the original content
4. Order skills by relevance to the job requirements
5. Keep bullets concise (under 15 words each)
6. ONLY include information that exists in the original profile - never fabricate

Return ONLY the JSON object, no markdown code blocks.`;
}

export function buildCoverLetterPrompt(
	profile: {
		name: string;
		headline?: string;
		summary?: string;
		topExperiences: string[];
		skills: string[];
	},
	jobDescription: string,
	jobTitle: string,
	companyName: string,
	recruiterName?: string
): string {
	const greeting = recruiterName ? `Dear ${recruiterName}` : "Dear Hiring Team";

	return `
## CANDIDATE PROFILE

**Name:** ${profile.name}
${profile.headline ? `**Current Role:** ${profile.headline}` : ""}
${profile.summary ? `**Background:** ${profile.summary}` : ""}

**Key Achievements:**
${profile.topExperiences.map((exp) => `- ${exp}`).join("\n")}

**Core Skills:** ${profile.skills.slice(0, 8).join(", ")}

---

## TARGET POSITION

**Role:** ${jobTitle}
**Company:** ${companyName}

**Job Description:**
${jobDescription}

---

## YOUR TASK

Write a compelling cover letter with exactly this structure:

**Opening paragraph:** Start with "${greeting}," then write 2-3 sentences that:
- Express genuine interest in THIS specific role
- Briefly mention your most relevant qualification
- Reference something specific about ${companyName}

**Body paragraph 1 (Experience):** 3-4 sentences showcasing:
- Your most relevant accomplishment with metrics
- How your experience directly maps to their requirements
- A specific technical or domain skill they need

**Body paragraph 2 (Company Fit):** 2-3 sentences about:
- Why ${companyName} specifically appeals to you
- How your values/interests align with their mission
- What unique perspective you'd bring

**Closing paragraph:** 2-3 sentences:
- Reaffirm enthusiasm
- Mention your availability
- Thank them for consideration

Sign off as:
Best regards,
${profile.name}

---

Return ONLY the cover letter text, no JSON or markdown formatting.
Keep it under 350 words total.`;
}
