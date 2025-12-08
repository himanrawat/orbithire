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

type ExtractedCustomSection = { id: string; title: string; entries: string[] };

const allowedMimeTypes = new Set([
	"application/pdf",

	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",

	"text/plain",
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

function reconstructTextFromPdf(pdfData: any) {
	if (!pdfData?.Pages) return "";

	const linesMap = new Map<
		number,
		{ y: number; items: { x: number; text: string }[] }
	>();

	for (const page of pdfData.Pages) {
		for (const textItem of page.Texts || []) {
			const yRaw = typeof textItem.y === "number" ? textItem.y : 0;

			// Group nearby y positions so fragmented lines are merged

			const yKey = Math.round(yRaw * 4) / 4;

			const xPos = typeof textItem.x === "number" ? textItem.x : 0;

			const decoded = (textItem.R || [])

				.map((r: any) => decodeURIComponent(r.T || ""))

				.join("");

			if (!decoded.trim()) continue;

			if (!linesMap.has(yKey)) {
				linesMap.set(yKey, { y: yKey, items: [] });
			}

			linesMap.get(yKey)!.items.push({ x: xPos, text: decoded });
		}
	}

	// pdf2json uses PDF coordinates (origin bottom-left), so sort Y descending to get top-to-bottom.
	const orderedLines = Array.from(linesMap.values()).sort((a, b) => b.y - a.y);

	const normalized = orderedLines.map((line) =>
		line.items

			.sort((a, b) => a.x - b.x)

			.map((item) => item.text.trim())

			.filter(Boolean)

			.join(" ")
	);

	return normalized.join("\n").trim();
}

const LLM_TEXT_LIMIT = 40000;

type ProfileDraft = {
	profile: {
		full_name: string;
		email: string;
		phone: string;
		summary: string;
	};
	skills: string[];
	work_experience: ExtractedExperience[];
	education: ExtractedEducation[];
	customSections: ExtractedCustomSection[];
};

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
			education: [
				"institution",
				"degree",
				"location",
				"start_date",
				"end_date",
			],
			customSections: ["title", "entries[]"],
		},
		instructions:
			"Return JSON only. Keep IDs from draft when present. Use empty strings/arrays when data is absent. Do not invent facts.",
	};

	async function run(model: string) {
		return client.chat.completions.create({
			model,
			messages: [
				{
					role: "system",
					content:
						"You are a resume parser. Normalize fields into the provided schema. Do not fabricate data. Keep the structure faithful to the text.",
				},
				{
					role: "user",
					content: JSON.stringify(payload),
				},
			],
			response_format: { type: "json_object" },
			temperature: 0,
			max_tokens: 1200,
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

function normalizeHeading(line: string) {
	const cleaned = line
		.toLowerCase()
		.replace(/[^a-z\s]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/:$/, "");
	return headingMap[cleaned];
}

function randomId() {
	return crypto.randomUUID();
}

function cleanLine(line: string) {
	return line
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+/g, " ")
		.trim();
}

function splitIntoSections(rawLines: string[]) {
	const sections: SectionBlock[] = [];
	let current: SectionBlock = { title: "body", lines: [] };

	for (const line of rawLines) {
		const normalizedLine = cleanLine(line);
		if (!normalizedLine) {
			continue;
		}
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

		// Bullet-only lists without a header: keep each bullet as its own entry
		if (isBullet && current.length === 0) {
			chunks.push([cleaned]);
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

		current.push(cleaned);
		hasBullet = hasBullet || isBullet;
	}
	flush();
	return chunks;
}

function extractSkills(lines: string[]) {
	const text = lines.join(" ");

	const parts = text

		.split(/[,;\n]/)

		.map((item) => item.trim())

		.filter(Boolean);

	return Array.from(new Set(parts));
}

function extractExperience(block: SectionBlock): ExtractedExperience[] {
	const chunks = splitChunks(block.lines);
	return chunks.map((chunk) => {
		const header = chunk[0] || "";
		const bodyText = chunk.join(" ").trim();
		const description = chunk.slice(1).join(" ").trim();
		const dateMatch = bodyText.match(
			/(20\d{2}|19\d{2}).{0,20}(20\d{2}|19\d{2}|present|Present)/i
		);
		const [start_date, end_date] = dateMatch
			? [dateMatch[1] || "", dateMatch[2] || ""]
			: ["", ""];

		const headerWithoutDates = dateMatch
			? header.replace(dateMatch[0], "").trim()
			: header;
		const dashSplit = headerWithoutDates.split(/\s+[\u2013\u2014-]\s+/);
		let role = headerWithoutDates || bodyText;
		let company = "";
		if (dashSplit.length >= 2) {
			const [first, second] = dashSplit;
			if (
				/\b(developer|designer|engineer|manager|lead|intern|director)\b/i.test(
					second
				)
			) {
				company = first.trim();
				role = second.trim();
			} else {
				role = first.trim();
				company = second.trim();
			}
		} else {
			const companySplit = headerWithoutDates.split(/ at | @ /i);
			role = companySplit[0]?.trim() || headerWithoutDates || bodyText;
			company = companySplit[1]?.replace(/\s+-.*$/, "").trim() || "";
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

		const institutionMatch = header.match(/at\s+(.*)$/i);

		const degree = institutionMatch
			? header.slice(0, institutionMatch.index).trim()
			: header;

		const institution = institutionMatch ? institutionMatch[1] : header;

		const dates = chunk

			.join(" ")

			.match(/(20\d{2}|19\d{2}).{0,10}(20\d{2}|19\d{2}|present|Present)/i);

		const [start_date, end_date] = dates
			? [dates[1] || "", dates[2] || ""]
			: ["", ""];

		return {
			id: randomId(),

			institution: institution.trim(),

			degree: degree.trim(),

			location: "",

			start_date,

			end_date,
		};
	});
}

function extractCustomSections(blocks: SectionBlock[]) {
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

			entries: splitChunks(block.lines).map((chunk) => chunk.join(" ")),
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
	};
}

async function extractPdfText(buffer: Buffer) {
	// pdf2json exposes an event-driven parser; wrap it in a promise for easier flow control.

	// needRawText flag enables getRawTextContent to return actual text.

	const PDFParserModule = await import("pdf2json");

	const PDFParser = (PDFParserModule as any).default ?? PDFParserModule;

	const pdfParser = new (PDFParser as any)(null, 1);

	return new Promise<string>((resolve, reject) => {
		pdfParser.on("pdfParser_dataError", (errData: any) => {
			reject(errData?.parserError || errData);
		});

		pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
			try {
				const textFromLayout = reconstructTextFromPdf(pdfData);

				const rawText =
					typeof pdfParser.getRawTextContent === "function"
						? pdfParser.getRawTextContent()
						: "";

				const text = textFromLayout.trim() || rawText;

				resolve(text);
			} catch (err) {
				reject(err);
			}
		});

		pdfParser.parseBuffer(buffer);
	});
}

async function bufferToText(
	file: File,

	mimeType: string
): Promise<{ text: string; fileName: string }> {
	const arrayBuffer = await file.arrayBuffer();

	const buffer = Buffer.from(arrayBuffer);

	const fileName = file.name || "upload";

	if (mimeType === "text/plain") {
		return { text: normalizeExtractedText(buffer.toString("utf8")), fileName };
	}

	if (mimeType === "application/pdf") {
		const text = normalizeExtractedText(await extractPdfText(buffer));
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
			{ error: "Unsupported file type. Use PDF, DOCX, or TXT." },

			{ status: 400 }
		);
	}

	try {
		const { text, fileName } = await bufferToText(file, mimeType);

		if (!text.trim()) {
			return NextResponse.json(
				{ error: "No readable text found in the file." },

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

		const customSections = extractCustomSections(sections);

		const draft: ProfileDraft = {
			profile: {
				full_name: contact.full_name,

				email: contact.email,

				phone: contact.phone,

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

		const merged: ProfileDraft = llmResult
			? {
					profile: { ...draft.profile, ...(llmResult.profile || {}) },

					skills: llmResult.skills?.length ? llmResult.skills : draft.skills,

					work_experience: (llmResult.work_experience?.length
						? llmResult.work_experience
						: draft.work_experience
					).map((exp: ExtractedExperience, idx: number) => ({
						...exp,

						id: exp.id || draft.work_experience[idx]?.id || randomId(),
					})),

					education: (llmResult.education?.length
						? llmResult.education
						: draft.education
					).map((edu: ExtractedEducation, idx: number) => ({
						...edu,

						id: edu.id || draft.education[idx]?.id || randomId(),
					})),

					customSections: (llmResult.customSections?.length
						? llmResult.customSections
						: draft.customSections
					).map((section: ExtractedCustomSection, idx: number) => ({
						...section,

						id: section.id || draft.customSections[idx]?.id || randomId(),
					})),
			  }
			: draft;

		// console.log("PDF extraction result", {
		// 	fileName,
		// 	mimeType,
		// 	rawTextLength: text.length,
		// 	rawTextPreview: text.slice(0, 1000),
		// 	draft,
		// 	llmApplied: Boolean(llmResult),
		// 	result: merged,
		// });

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
