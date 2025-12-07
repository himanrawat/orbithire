import { NextResponse, type NextRequest } from "next/server";
import OpenAI from "openai";
import mammoth from "mammoth";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

type SectionBlock = { title: string; lines: string[] };

type ExtractedExperience = {
	id: string;
	role: string;
	company: string;
	location: string;
	start_date: string;
	end_date: string;
	description: string;
};

type ExtractedEducation = {
	id: string;
	institution: string;
	degree: string;
	location: string;
	start_date: string;
	end_date: string;
};

// type ExtractedCustomSection = { id: string; title: string; entries: string[] };
type ExtractedCustomSection = {
	id: string;
	title: string;
	entries: Array<{
		id: string;
		title: string;
		description: string;
	}>;
};

const allowedMimeTypes = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/plain",
	"image/png",
	"image/jpeg",
]);

const headingMap: Record<string, string> = {
	summary: "summary",
	profile: "summary",
	overview: "summary",
	"work experience": "experience",
	experience: "experience",
	"professional experience": "experience",
	employment: "experience",
	"employment history": "experience",
	education: "education",
	academics: "education",
	"education & certification": "education",
	"education & certifications": "education",
	"education certification": "education",
	"certifications & education": "education",
	skills: "skills",
	"technical skills": "skills",
	"key skills": "skills",
	projects: "projects",
	"project experience": "projects",
	certifications: "certifications",
	licenses: "certifications",
	languages: "languages",
	awards: "awards",
	achievements: "awards",
	volunteering: "volunteering",
};

const bulletRegex = /^[\u2022\u00b7*-]\s*/;

function normalizeExtractedText(text: string) {
	return text
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+/g, " ")
		.replace(/ *\n */g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function keepLongest(preferred: string, fallback: string) {
	return preferred && preferred.length >= fallback.length * 0.9
		? preferred
		: fallback;
}

function normalizeSkills(lines: string[]) {
	const text = lines.join(" ");
	const parts = text
		.split(/[,;\n]/)
		.map((item) => item.trim())
		.filter(Boolean)
		.flatMap((item) => {
			const colonIdx = item.indexOf(":");
			if (colonIdx > -1 && colonIdx < item.length - 1) {
				return item
					.slice(colonIdx + 1)
					.split(/[,;]/)
					.map((s) => s.trim());
			}
			return item;
		});
	return Array.from(new Set(parts.filter(Boolean)));
}

function randomId() {
	return crypto.randomUUID();
}

function normalizeHeading(line: string) {
	const cleaned = line
		.toLowerCase()
		.replace(/[^a-z\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/:$/, "");
	return headingMap[cleaned];
}

function cleanLine(line: string) {
	return line
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+/g, " ")
		.trim();
}

function cleanRoleOrCompany(text: string) {
	return text.replace(/\s*[|–—-]\s*$/g, "").trim();
}

function isResumeLike(text: string) {
	const lower = text.toLowerCase();
	const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
	const hasPhone = /\+?\d[\d\s().-]{7,}\d/.test(text);
	const hasLink =
		/(linkedin\.com\/in|github\.com|behance\.net|portfolio|dribbble|bitbucket|gitlab)/i.test(
			text
		);
	const hasDates =
		/(19|20)\d{2}[^0-9]{0,12}(19|20)\d{2}|(19|20)\d{2}[^0-9]{0,6}present/i.test(
			text
		);

	const headings = [
		"work experience",
		"experience",
		"employment",
		"education",
		"skills",
		"projects",
		"certifications",
		"summary",
		"profile",
	];
	const headingHits = headings.filter((h) => lower.includes(h)).length;

	const roleTokens = [
		"developer",
		"designer",
		"engineer",
		"manager",
		"intern",
		"lead",
		"analyst",
	];
	const hasRoleToken = roleTokens.some((t) => lower.includes(t));

	const bullets = (text.match(/^[\u2022\u00b7*-]/gm) || []).length;

	let score = 0;
	if (hasEmail) score += 2;
	if (hasPhone) score += 2;
	if (hasLink) score += 1;
	if (hasDates) score += 2;
	if (headingHits >= 2) score += 3;
	else if (headingHits === 1) score += 1;
	if (hasRoleToken) score += 1;
	if (bullets >= 3) score += 1;

	const negativeKeywords = [
		"report",
		"invoice",
		"statement",
		"minutes",
		"reconnaissance",
		"timesheet",
	];
	const negativeHits = negativeKeywords.filter((k) => lower.includes(k)).length;
	if (negativeHits) score -= 2 * negativeHits;

	// Require a modest score and at least one core signal.
	const coreSignals = hasEmail || hasPhone || headingHits >= 2 || hasDates;
	return coreSignals && score >= 4;
}

function splitIntoSections(rawLines: string[]) {
	const sections: SectionBlock[] = [];
	let current: SectionBlock = { title: "body", lines: [] };

	for (const line of rawLines) {
		const normalizedLine = cleanLine(line);
		if (!normalizedLine) continue;
		const heading = normalizeHeading(normalizedLine);
		if (heading) {
			if (current.lines.length > 0) {
				sections.push(current);
			}
			current = { title: heading, lines: [] };
		} else {
			current.lines.push(normalizedLine);
		}
	}

	if (current.lines.length > 0) {
		sections.push(current);
	}

	return sections;
}

function splitChunks(lines: string[]) {
	const chunks: string[][] = [];
	let current: string[] = [];
	let hasBullet = false;

	const flush = () => {
		if (current.length) {
			chunks.push(current);
			current = [];
			hasBullet = false;
		}
	};

	const looksLikeHeader = (line: string) =>
		/(19|20)\d{2}|present|Present/.test(line) || /[|\u2013-]/.test(line);

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed === "") {
			flush();
			continue;
		}

		const isBullet = bulletRegex.test(trimmed);
		const cleaned = trimmed.replace(bulletRegex, "");

		if (isBullet && current.length === 0) {
			chunks.push([`- ${cleaned}`]);
			continue;
		}

		const incomingHeader = looksLikeHeader(cleaned);
		const currentHeader = current.length > 0 && looksLikeHeader(current[0]);
		const hasBody = hasBullet || current.length > 1;

		if (
			!isBullet &&
			current.length &&
			currentHeader &&
			incomingHeader &&
			hasBody
		) {
			flush();
		}

		current.push(isBullet ? `- ${cleaned}` : cleaned);
		hasBullet = hasBullet || isBullet;
	}
	flush();
	return chunks;
}

function extractSkills(lines: string[]) {
	return normalizeSkills(lines);
}

function extractExperience(block: SectionBlock): ExtractedExperience[] {
	const chunks = splitChunks(block.lines);
	return chunks.map((chunk) => {
		const header = chunk[0] || "";
		const bodyText = chunk.join(" ").trim();
		const description = chunk.slice(1).join("\n").trim();
		const dateMatch = bodyText.match(
			/(20\d{2}|19\d{2}).{0,20}(20\d{2}|19\d{2}|present|Present)/i
		);
		const [start_date, end_date] = dateMatch
			? [dateMatch[1] || "", dateMatch[2] || ""]
			: ["", ""];

		const headerWithoutDates = dateMatch
			? header.replace(dateMatch[0], "").trim()
			: header;
		const dashSplit = headerWithoutDates.split(/\s*[|\u2013\u2014-]\s+/);
		let role = headerWithoutDates || bodyText;
		let company = "";
		if (dashSplit.length >= 2) {
			const [first, second] = dashSplit;
			if (
				/\b(developer|designer|engineer|manager|lead|intern|director)\b/i.test(
					second
				)
			) {
				company = cleanRoleOrCompany(first);
				role = cleanRoleOrCompany(second);
			} else {
				role = cleanRoleOrCompany(first);
				company = cleanRoleOrCompany(second);
			}
		} else {
			const companySplit = headerWithoutDates.split(/ at | @ /i);
			role = cleanRoleOrCompany(
				companySplit[0]?.trim() || headerWithoutDates || bodyText
			);
			company = cleanRoleOrCompany(
				companySplit[1]?.replace(/\s+-.*$/, "").trim() || companySplit[1] || ""
			);
		}

		return {
			id: randomId(),
			role,
			company,
			location: "",
			start_date,
			end_date,
			description,
		};
	});
}

function extractEducation(block: SectionBlock): ExtractedEducation[] {
	const chunks = splitChunks(block.lines);
	return chunks.map((chunk) => {
		const header = chunk[0] || "";
		let degree = header;
		let institution = header;

		const parts = header.split(/\s*[|\u2013\u2014-]\s+/);
		if (parts.length >= 2) {
			[degree, institution] = parts;
		} else {
			const institutionMatch = header.match(/at\s+(.*)$/i);
			degree = institutionMatch
				? header.slice(0, institutionMatch.index).trim()
				: header;
			institution = institutionMatch ? institutionMatch[1] : header;
		}

		const dates = chunk
			.join(" ")
			.match(/(20\d{2}|19\d{2}).{0,10}(20\d{2}|19\d{2}|present|Present)/i);
		const [start_date, end_date] = dates
			? [dates[1] || "", dates[2] || ""]
			: ["", ""];

		const yearTokens = (header.match(/\b(19|20)\d{2}\b/g) || []).filter(
			Boolean
		);
		let eduStart = start_date;
		let eduEnd = end_date;
		if (!start_date && yearTokens.length) {
			eduStart = yearTokens[0];
			eduEnd = yearTokens[yearTokens.length - 1];
		}

		institution = institution
			.replace(/\b(19|20)\d{2}\b/g, "")
			.replace(/\(\s*\)/g, "")
			.trim();

		return {
			id: randomId(),
			institution: institution.trim(),
			degree: degree.trim(),
			location: "",
			start_date: eduStart,
			end_date: eduEnd,
		};
	});
}

// function extractCustomSections(blocks: SectionBlock[]) {
// 	const splitCustomEntries = (lines: string[]) => {
// 		const entries: string[] = [];
// 		let currentTitle: string | null = null;
// 		let currentBody: string[] = [];

// 		const looksHeading = (line: string) =>
// 			!/^-/.test(line) &&
// 			(/[–—-]/.test(line) ||
// 				/^[A-Z][A-Za-z0-9 .,&'()/-]{3,}$/.test(line.trim()) ||
// 				/\bcase study\b/i.test(line));

// 		const flush = () => {
// 			if (currentTitle || currentBody.length) {
// 				const combined = [currentTitle, ...currentBody]
// 					.filter(Boolean)
// 					.join("\n")
// 					.trim();
// 				if (combined) entries.push(combined);
// 			}
// 			currentTitle = null;
// 			currentBody = [];
// 		};

// 		for (const raw of lines) {
// 			const line = raw.trim();
// 			if (!line) {
// 				flush();
// 				continue;
// 			}
// 			const isHeading = looksHeading(line);
// 			if (isHeading) {
// 				flush();
// 				currentTitle = line;
// 			} else {
// 				currentBody.push(
// 					line.startsWith("-") || line.startsWith("•") ? line : `- ${line}`
// 				);
// 			}
// 		}
// 		flush();
// 		return entries;
// 	};

// 	return blocks
// 		.filter(
// 			(block) =>
// 				!["summary", "experience", "education", "skills", "body"].includes(
// 					block.title
// 				)
// 		)
// 		.map<ExtractedCustomSection>((block) => ({
// 			id: randomId(),
// 			title: block.title.replace(/\b\w/g, (c) => c.toUpperCase()),
// 			entries: splitCustomEntries(block.lines),
// 		}))
// 		.filter((section) => section.entries.length > 0);
// }

function extractCustomSections(blocks: SectionBlock[]) {
	const splitCustomEntries = (lines: string[]) => {
		const entries: Array<{ id: string; title: string; description: string }> =
			[];
		let currentTitle: string | null = null;
		let currentBody: string[] = [];

		const looksHeading = (line: string) =>
			!/^[•\-]/.test(line.trim()) &&
			(/[–—]/.test(line) ||
				/^[A-Z][A-Za-z0-9 .,&'()/-]{3,}$/.test(line.trim()) ||
				/\bcase study\b/i.test(line) ||
				(/^[A-Z]/.test(line.trim()) && line.trim().length < 100));

		const flush = () => {
			if (currentTitle) {
				const description = currentBody.filter(Boolean).join("\n").trim();

				entries.push({
					id: randomId(),
					title: currentTitle,
					description: description || "",
				});
			}
			currentTitle = null;
			currentBody = [];
		};

		for (const raw of lines) {
			const line = raw.trim();
			if (!line) {
				flush();
				continue;
			}

			const isHeading = looksHeading(line);

			if (isHeading) {
				flush();
				currentTitle = line;
			} else {
				// Clean up bullet points but keep them
				const cleaned = line.replace(/^[•\-]\s*/, "• ");
				currentBody.push(cleaned);
			}
		}
		flush();
		return entries;
	};

	return blocks
		.filter(
			(block) =>
				!["summary", "experience", "education", "skills", "body"].includes(
					block.title
				)
		)
		.map<ExtractedCustomSection>((block) => ({
			id: randomId(),
			title: block.title.replace(/\b\w/g, (c) => c.toUpperCase()),
			entries: splitCustomEntries(block.lines),
		}))
		.filter((section) => section.entries.length > 0);
}

function extractSummary(blocks: SectionBlock[]) {
	const summaryBlock = blocks.find((b) => b.title === "summary");
	if (!summaryBlock) return "";
	return summaryBlock.lines.join(" ").trim();
}

function extractContact(rawText: string, lines: string[]) {
	const normalizedText = normalizeExtractedText(rawText);
	const emailMatch = normalizedText.match(
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
	);
	const phoneMatch = normalizedText.match(/\+?\d[\d\s().-]{7,}\d/);
	const linkMatches =
		normalizedText.match(
			/https?:\/\/\S+|(?:www\.)?(?:linkedin\.com\/in\/\S+|github\.com\/\S+|behance\.net\/\S+)/gi
		) || [];

	const candidateName =
		lines.find(
			(line) =>
				line.length > 5 &&
				line.length < 80 &&
				!line.includes("@") &&
				!/[0-9]{3,}/.test(line)
		) || "";

	return {
		full_name: candidateName,
		email: emailMatch?.[0] || "",
		phone: phoneMatch?.[0] || "",
		links: Array.from(new Set(linkMatches)),
	};
}

const LLM_TEXT_LIMIT = 40000;

// type ProfileDraft = {
// 	profile: {
// 		full_name: string;
// 		email: string;
// 		phone: string;
// 		location?: string;
// 		portfolio?: string;
// 		github_url?: string;
// 		linkedin_url?: string;
// 		summary: string;
// 	};
// 	skills: string[];
// 	work_experience: ExtractedExperience[];
// 	education: ExtractedEducation[];
// 	customSections: ExtractedCustomSection[];
// };

type ProfileDraft = {
	profile: {
		full_name: string;
		email: string;
		phone: string;
		location?: string;
		portfolio?: string;
		github_url?: string;
		linkedin_url?: string;
		summary: string;
	};
	skills: string[];
	work_experience: ExtractedExperience[];
	education: ExtractedEducation[];
	customSections: ExtractedCustomSection[];
};

// async function enhanceWithLlm(rawText: string, draft: ProfileDraft) {
// 	const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
// 	if (!apiKey) return null;

// 	const useGroq = Boolean(process.env.GROQ_API_KEY);
// 	const client = new OpenAI({
// 		apiKey,
// 		baseURL: useGroq ? "https://api.groq.com/openai/v1" : undefined,
// 	});
// 	const primaryModel =
// 		process.env.LLM_MODEL ||
// 		(useGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
// 	const fallbackModel = "gpt-4o-mini";

// 	const truncatedText =
// 		rawText.length > LLM_TEXT_LIMIT
// 			? rawText.slice(0, LLM_TEXT_LIMIT)
// 			: rawText;

// 	const payload = {
// 		rawText: truncatedText,
// 		draft,
// 		schema: {
// 			profile: ["full_name", "email", "phone", "summary"],
// 			skills: "string[]",
// 			work_experience: [
// 				"role",
// 				"company",
// 				"location",
// 				"start_date",
// 				"end_date",
// 				"description",
// 			],
// 			education: [
// 				"institution",
// 				"degree",
// 				"location",
// 				"start_date",
// 				"end_date",
// 			],
// 			customSections: ["title", "entries[]"],
// 		},
// 		instructions: [
// 			// Output format
// 			"Return ONLY a single JSON object.",
// 			'The top-level shape must be exactly: {"profile":{...},"skills":[...],"work_experience":[...],"education":[...],"customSections":[...]}.',
// 			"Use ONLY the fields described in `schema`. Do not add any extra top-level keys or extra properties on objects.",
// 			"The JSON must be valid and directly parseable with JSON.parse, with no surrounding text or comments.",

// 			// Relationship between rawText and draft
// 			"Use `rawText` as the source of truth for what appears in the resume.",
// 			"Use `draft` as the authoritative base structure and IDs.",
// 			"When a field in `draft` is non-empty, you MUST NOT change its meaning: you may only normalize whitespace (trim spaces, fix double spaces) or fix obvious OCR artifacts.",
// 			"You MUST NOT alter or upgrade non-empty values for: degree titles, institution names, company names, role titles, or date ranges that appear in `draft`.",
// 			"If `draft` has a non-empty value and `rawText` appears to disagree, keep the draft value.",

// 			// When you are allowed to fill or change fields
// 			"Only fill a field from the resume text when the draft value is empty.",
// 			"If you cannot find a value explicitly in `rawText`, leave that field as an empty string or empty array.",
// 			"Do NOT infer or guess missing data (for example, do not guess a location, degree level, company name, or dates).",
// 			"Never invent new skills, tools, technologies, locations, companies, degrees, or projects that are not clearly present in `rawText`.",

// 			// Array lengths & IDs
// 			"For work_experience, education and customSections, do NOT remove entries that are present in `draft`.",
// 			"Keep the same order as `draft` for existing entries.",
// 			"You may add a new entry ONLY if you clearly see an additional distinct item in `rawText` that is not already represented in `draft`, and you must copy it verbatim from the text.",
// 			"When you add a new entry, set its `id` to an empty string; never change the `id` of existing draft entries.",
// 			"For existing entries, always keep the same `id` as in `draft`.",

// 			// Summary, descriptions, bullets
// 			"Do NOT shorten, summarize, or paraphrase any text taken from the resume.",
// 			"Preserve all sentences and important phrases as they appear in `rawText`.",
// 			"Preserve bullet lists as separate lines starting with '- ' and do NOT merge multiple bullets into one paragraph.",
// 			"For descriptions, keep the original wording and order of bullets and sentences.",

// 			// Skills
// 			"For `skills`, only include skills that are explicitly present in `rawText` or in `draft`.",
// 			"Do NOT group skills into new categories or rename them; keep their wording as close as possible to the original.",
// 			"If you are unsure whether a word is a skill, leave it out.",

// 			// Custom sections
// 			"For `customSections`, keep the same sections as in `draft` when they exist.",
// 			"Preserve URLs exactly as they appear in the text.",
// 			"Keep titles/headings separate from descriptions: when a block has a clear title line and then body text, put the title in `title` and put the remaining lines in `entries`.",
// 			"Within `entries`, preserve line breaks and bullets as in the original text as much as possible.",

// 			// Uncertainty
// 			"If you are uncertain about any value, leave it empty rather than guessing.",
// 			"If a piece of information is not clearly present in `rawText` and not in `draft`, do NOT create it.",
// 		].join(" "),
// 	};

// 	async function run(model: string) {
// 		return client.chat.completions.create({
// 			model,
// 			messages: [
// 				{
// 					role: "system",
// 					content:
// 						"You are a resume parser. Normalize fields into the provided schema. Do not fabricate data. Keep the structure faithful to the text.",
// 				},
// 				{
// 					role: "user",
// 					content: JSON.stringify(payload),
// 				},
// 			],
// 			response_format: { type: "json_object" },
// 			temperature: 0,
// 			max_tokens: 1200,
// 		});
// 	}

// 	let response;
// 	try {
// 		response = await run(primaryModel);
// 	} catch (err: any) {
// 		const code = err?.code || err?.error?.code;
// 		if (code === "model_decommissioned" && !process.env.LLM_MODEL) {
// 			console.warn(
// 				`Model ${primaryModel} decommissioned; retrying with ${fallbackModel}`
// 			);
// 			response = await run(fallbackModel);
// 		} else {
// 			throw err;
// 		}
// 	}

// 	const content = response.choices?.[0]?.message?.content;
// 	if (!content) return null;

// 	try {
// 		return JSON.parse(content);
// 	} catch (err) {
// 		console.error("LLM parse error", err);
// 		return null;
// 	}
// }

// Key changes to fix custom sections issue:

async function enhanceWithLlm(rawText: string, draft: ProfileDraft) {
	const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
	if (!apiKey) return null;

	const useGroq = Boolean(process.env.GROQ_API_KEY);
	const client = new OpenAI({
		apiKey,
		baseURL: useGroq ? "https://api.groq.com/openai/v1" : undefined,
	});
	const primaryModel =
		process.env.LLM_MODEL ||
		(useGroq ? "llama-3.3-70b-versatile" : "gpt-4o-mini");
	const fallbackModel = "gpt-4o-mini";

	const truncatedText =
		rawText.length > LLM_TEXT_LIMIT
			? rawText.slice(0, LLM_TEXT_LIMIT)
			: rawText;

	const payload = {
		rawText: truncatedText,
		draft,
		schema: {
			profile: [
				"full_name",
				"email",
				"phone",
				"summary",
				"location",
				"portfolio",
				"github_url",
				"linkedin_url",
			],
			skills: "string[]",
			work_experience: [
				"id",
				"role",
				"company",
				"location",
				"start_date",
				"end_date",
				"description",
			],
			education: [
				"id",
				"institution",
				"degree",
				"location",
				"start_date",
				"end_date",
			],
			customSections: {
				description:
					"Array of additional resume sections like Projects, Certifications, Awards, etc.",
				fields: ["id", "title", "entries"],
				entries_format:
					"Array of strings, each string is a paragraph or bullet point from that section",
			},
		},
		instructions: [
			// Output format
			"Return ONLY a single JSON object.",
			'The top-level shape must be exactly: {"profile":{...},"skills":[...],"work_experience":[...],"education":[...],"customSections":[...]}.',
			"Use ONLY the fields described in `schema`. Do not add any extra top-level keys or extra properties on objects.",
			"The JSON must be valid and directly parseable with JSON.parse, with no surrounding text or comments.",

			// Relationship between rawText and draft
			"Use `rawText` as the source of truth for what appears in the resume.",
			"Use `draft` as the authoritative base structure and IDs.",

			// Custom sections handling - CRITICAL
			"IMPORTANT: customSections in draft contain valuable data like Projects, Certifications, Awards, etc.",
			"You MUST preserve all customSections from draft unless they are clearly not present in rawText.",
			"For customSections, keep all entries from draft and preserve their exact wording.",
			"Each entry in customSections.entries should be preserved as-is from the draft.",

			// Field handling
			"When a field in `draft` is non-empty, you MUST NOT change its meaning: you may only normalize whitespace (trim spaces, fix double spaces) or fix obvious OCR artifacts.",
			"You MUST NOT alter or upgrade non-empty values for: degree titles, institution names, company names, role titles, or date ranges that appear in `draft`.",
			"Only fill a field from the resume text when the draft value is empty.",
			"If you cannot find a value explicitly in `rawText`, leave that field as an empty string or empty array.",
			"Do NOT infer or guess missing data.",
			"Never invent new skills, tools, technologies, locations, companies, degrees, or projects that are not clearly present in `rawText` or `draft`.",

			// Array lengths & IDs
			"For work_experience, education and customSections, do NOT remove entries that are present in `draft`.",
			"Keep the same order as `draft` for existing entries.",
			"When you add a new entry, set its `id` to an empty string; never change the `id` of existing draft entries.",
			"For existing entries, always keep the same `id` as in `draft`.",

			// Preserve content
			"Do NOT shorten, summarize, or paraphrase any text taken from the resume.",
			"Preserve all sentences and important phrases as they appear in `rawText` or `draft`.",
			"Preserve bullet lists as separate lines starting with '- ' and do NOT merge multiple bullets into one paragraph.",
			"For descriptions and entries, keep the original wording and order of bullets and sentences.",
			"Preserve URLs exactly as they appear in the text or draft.",

			// Skills
			"For `skills`, only include skills that are explicitly present in `rawText` or in `draft`.",
			"Do NOT group skills into new categories or rename them.",

			// Uncertainty
			"If you are uncertain about any value, keep it from draft rather than removing it.",
			"If a piece of information is not clearly present in `rawText` but IS in `draft`, keep the draft version.",
		].join(" "),
	};

	async function run(model: string) {
		return client.chat.completions.create({
			model,
			messages: [
				{
					role: "system",
					content:
						"You are a resume parser. Your job is to enhance and normalize the draft data while preserving all information. Never remove sections or entries that exist in the draft. Keep custom sections intact.",
				},
				{
					role: "user",
					content: JSON.stringify(payload),
				},
			],
			response_format: { type: "json_object" },
			temperature: 0,
			max_tokens: 3000, // INCREASED from 1200 to handle custom sections
		});
	}

	let response;
	try {
		response = await run(primaryModel);
	} catch (err: any) {
		const code = err?.code || err?.error?.code;
		if (code === "model_decommissioned" && !process.env.LLM_MODEL) {
			console.warn(
				`Model ${primaryModel} decommissioned; retrying with ${fallbackModel}`
			);
			response = await run(fallbackModel);
		} else {
			throw err;
		}
	}

	const content = response.choices?.[0]?.message?.content;
	if (!content) return null;

	try {
		return JSON.parse(content);
	} catch (err) {
		console.error("LLM parse error", err);
		return null;
	}
}

async function parseImageWithLlm(file: File) {
	const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("Vision model requires an API key.");
	}
	const useGroq = Boolean(process.env.GROQ_API_KEY);
	const client = new OpenAI({
		apiKey,
		baseURL: useGroq ? "https://api.groq.com/openai/v1" : undefined,
	});
	const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
	const mimeType = file.type || "image/png";
	const visionModel =
		process.env.VISION_MODEL || process.env.LLM_MODEL || "gpt-4o";

	const schema = {
		profile: ["full_name", "email", "phone", "summary"],
		skills: "string[]",
		work_experience: [
			"role",
			"company",
			"location",
			"start_date",
			"end_date",
			"description",
		],
		education: ["institution", "degree", "location", "start_date", "end_date"],
		customSections: ["title", "entries[]"],
	};

	const response = await client.chat.completions.create({
		model: visionModel,
		response_format: { type: "json_object" },
		temperature: 0,
		max_tokens: 1200,
		messages: [
			{
				role: "system",
				content:
					"You are a resume parser. Use the image to extract fields into the provided schema. Do not fabricate data. Do not shorten or paraphrase; preserve all sentences and bullets. Only use fields in the schema; leave missing fields empty.",
			},
			{
				role: "user",
				content: [
					{
						type: "text",
						text: JSON.stringify({
							schema,
							instructions:
								"Return JSON only. Preserve bullets and sentences. Keep links in entries. Leave empty strings/arrays if absent.",
						}),
					},
					{
						type: "image_url",
						image_url: { url: `data:${mimeType};base64,${base64}` },
					},
				],
			},
		],
	});

	const content = response.choices?.[0]?.message?.content;
	if (!content) throw new Error("No vision response");
	let parsed: any;
	try {
		parsed = JSON.parse(content);
	} catch (err) {
		throw new Error("Unable to parse vision JSON");
	}
	return parsed;
}

async function extractPdfText(data: Uint8Array) {
	// pdfjs-dist runs server-side; worker is disabled via isEvalSupported flag.
	// Use the legacy build entry to avoid bundling issues.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
	const loadingTask = pdfjsLib.getDocument({
		data,
		isEvalSupported: false,
		useSystemFonts: true,
		verbosity: pdfjsLib.VerbosityLevel?.ERRORS,
	});
	const doc = await loadingTask.promise;
	const pages: string[] = [];

	for (let i = 1; i <= doc.numPages; i += 1) {
		const page = await doc.getPage(i);
		const content = await page.getTextContent();

		const lineMap = new Map<
			number,
			{ y: number; items: { x: number; text: string }[] }
		>();
		const yBucket = 2; // bucket y to merge nearby fragments on the same line

		for (const item of content.items as any[]) {
			const str = (item?.str || "").trim();
			if (!str) continue;

			const transform = Array.isArray(item?.transform) ? item.transform : [];
			const xRaw = transform[4];
			const yRaw = transform[5];
			const x = typeof xRaw === "number" ? xRaw : 0;
			const y = typeof yRaw === "number" ? yRaw : 0;
			const yKey = Math.round(y / yBucket) * yBucket;

			if (!lineMap.has(yKey)) {
				lineMap.set(yKey, { y: yKey, items: [] });
			}
			lineMap.get(yKey)!.items.push({ x, text: str });
		}

		const lines = Array.from(lineMap.values())
			.sort((a, b) => b.y - a.y) // PDF coords origin bottom-left
			.map((line) =>
				line.items
					.sort((a, b) => a.x - b.x)
					.map((i) => i.text.trim())
					.filter(Boolean)
					.join(" ")
			)
			.map((line) => line.replace(/\s+/g, " ").trim())
			.filter(Boolean);

		pages.push(lines.join("\n"));
		await page.cleanup();
	}

	await doc.cleanup();
	return normalizeExtractedText(pages.filter(Boolean).join("\n\n"));
}

async function bufferToText(
	file: File,
	mimeType: string
): Promise<{ text: string; fileName: string }> {
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const uint8 = new Uint8Array(arrayBuffer);
	const fileName = file.name || "upload";

	if (mimeType === "text/plain") {
		return { text: normalizeExtractedText(buffer.toString("utf8")), fileName };
	}

	if (mimeType === "application/pdf") {
		const text = normalizeExtractedText(await extractPdfText(uint8));
		return { text, fileName };
	}

	if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		const result = await mammoth.extractRawText({ buffer });
		return { text: normalizeExtractedText(result.value), fileName };
	}

	throw new Error("Unsupported file type");
}

export async function POST(req: NextRequest) {
	const formData = await req.formData().catch(() => null);
	const file = formData?.get("file");

	if (!file || !(file instanceof File)) {
		return NextResponse.json({ error: "File is required." }, { status: 400 });
	}

	if (file.size > serverEnv.maxUploadBytes) {
		return NextResponse.json(
			{ error: "File is too large. Please upload up to 5MB." },
			{ status: 400 }
		);
	}

	const mimeType = file.type || "";
	if (!allowedMimeTypes.has(mimeType)) {
		return NextResponse.json(
			{
				error:
					"Unsupported file type. Use PDF, DOCX, TXT, or an image (PNG/JPEG).",
			},
			{ status: 400 }
		);
	}

	try {
		if (mimeType.startsWith("image/")) {
			const parsed = await parseImageWithLlm(file);
			return NextResponse.json({
				ok: true,
				fileName: file.name || "upload",
				profile: parsed.profile || {},
				skills: parsed.skills || [],
				work_experience: parsed.work_experience || [],
				education: parsed.education || [],
				customSections: parsed.customSections || [],
				rawText: "",
			});
		}

		const { text, fileName } = await bufferToText(file, mimeType);
		if (!text.trim()) {
			return NextResponse.json(
				{ error: "No readable text found in the file." },
				{ status: 400 }
			);
		}
		if (!isResumeLike(text)) {
			return NextResponse.json(
				{
					error:
						"This file doesn't look like a resume. Please upload a resume in PDF, DOCX, or TXT format.",
				},
				{ status: 400 }
			);
		}
		const rawLines = text.split(/\r?\n/).map(cleanLine);
		const sections = splitIntoSections(rawLines);
		const skills = sections.find((s) => s.title === "skills")?.lines?.length
			? extractSkills(sections.find((s) => s.title === "skills")!.lines)
			: [];
		const experiences = sections
			.filter((s) => s.title === "experience")
			.flatMap(extractExperience);
		const education = sections
			.filter((s) => s.title === "education")
			.flatMap(extractEducation);
		const summary = extractSummary(sections);
		const contact = extractContact(
			text,
			rawLines.map((l) => l.trim())
		);
		let customSections = extractCustomSections(sections);
		const draft: ProfileDraft = {
			profile: {
				full_name: contact.full_name,
				email: contact.email,
				phone: contact.phone,
				location: contact.links?.find((l) => /,/.test(l)) || "",
				portfolio:
					contact.links?.find((l) => l.includes("himanshurawat.in")) || "",
				github_url: contact.links?.find((l) => l.includes("github.com")) || "",
				linkedin_url:
					contact.links?.find((l) => l.includes("linkedin.com")) || "",
				summary,
			},
			skills,
			work_experience: experiences,
			education,
			customSections,
		};

		const llmResult = await enhanceWithLlm(text, draft).catch((err) => {
			console.error("LLM enhance error", err);
			return null;
		});
		// Use LLM output only; fallback to draft is disabled per request.
		const merged: ProfileDraft = llmResult
			? {
					profile: {
						full_name: llmResult.profile?.full_name || "",
						email: llmResult.profile?.email || "",
						phone: llmResult.profile?.phone || "",
						summary: llmResult.profile?.summary || "",
						location: llmResult.profile?.location || "",
						portfolio: llmResult.profile?.portfolio || "",
						github_url: llmResult.profile?.github_url || "",
						linkedin_url: llmResult.profile?.linkedin_url || "",
					},
					skills: llmResult.skills || [],
					work_experience: (llmResult.work_experience || []).map(
						(exp: ExtractedExperience) => ({
							...exp,
							role: cleanRoleOrCompany(exp.role || ""),
							company: cleanRoleOrCompany(exp.company || ""),
							description: exp.description || "",
							location: exp.location || "",
							id: exp.id || randomId(),
						})
					),
					education: (llmResult.education || []).map(
						(edu: ExtractedEducation) => ({
							...edu,
							institution: edu.institution || "",
							degree: edu.degree || "",
							location: edu.location || "",
							id: edu.id || randomId(),
						})
					),
					customSections: (llmResult.customSections || []).map(
						(section: ExtractedCustomSection) => ({
							...section,
							title: section.title || "",
							entries: section.entries || [],
							id: section.id || randomId(),
						})
					),
			  }
			: draft;

		console.log(
			"PDF extraction result",
			JSON.stringify(
				{
					fileName,
					mimeType,
					rawTextLength: text.length,
					rawTextPreview: text.slice(0, 1000),
					draft,
					llmApplied: Boolean(llmResult),
					result: merged,
				},
				null,
				2
			)
		);

		return NextResponse.json({
			ok: true,
			fileName,
			profile: merged.profile,
			skills: merged.skills,
			work_experience: merged.work_experience,
			education: merged.education,
			customSections: merged.customSections,
			rawText: text,
		});
	} catch (error) {
		console.error("Profile extract error:", error);
		return NextResponse.json(
			{ error: "Unable to extract data from the file." },
			{ status: 500 }
		);
	}
}
