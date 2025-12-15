import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export interface PDFGenerationResult {
	success: boolean;
	buffer?: Buffer;
	error?: string;
}

/**
 * Generate PDF from HTML content using Puppeteer
 * @param html - Full HTML document string
 * @returns PDF buffer
 */
export async function generatePDFFromHTML(
	html: string
): Promise<PDFGenerationResult> {
	let browser = null;

	// Resolve a usable Chromium/Chrome path across environments
	async function resolveExecutablePath(): Promise<string> {
		// Allow explicit override
		const envPath =
			process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROMIUM_PATH;
		if (envPath && existsSync(envPath)) return envPath;

		// Try the lightweight @sparticuz/chromium build (serverless-friendly)
		try {
			const chromiumPath = await chromium.executablePath();
			if (chromiumPath && existsSync(chromiumPath)) return chromiumPath;
		} catch {
			// fall through to full Puppeteer
		}

		// Fallback to the bundled Puppeteer download (works locally/CI)
		try {
			// Dynamically import to avoid bloating the serverless bundle when unused
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const fullPuppeteer = require("puppeteer") as typeof import("puppeteer");
			const fullPath = fullPuppeteer.executablePath();
			if (fullPath && existsSync(fullPath)) return fullPath;
		} catch {
			// Ignore, will throw below
		}

		throw new Error("No Chromium executable found for PDF generation");
	}

	try {
		const executablePath = await resolveExecutablePath();
		const headless =
			(chromium as unknown as { headless?: boolean }).headless ?? true;

		browser = await puppeteer.launch({
			args: chromium.args,
			executablePath,
			headless,
		});

		const page = await browser.newPage();

		// Set content and wait for fonts/styles to load
		await page.setContent(html, {
			waitUntil: ["domcontentloaded", "networkidle0"],
		});

		// Generate PDF
		const pdfBuffer = await page.pdf({
			format: "Letter",
			printBackground: true,
			margin: {
				top: "0.5in",
				right: "0.5in",
				bottom: "0.5in",
				left: "0.5in",
			},
		});

		return {
			success: true,
			buffer: Buffer.from(pdfBuffer),
		};
	} catch (error) {
		console.error("PDF generation error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "PDF generation failed",
		};
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

/**
 * Generate PDF for a cover letter from plain text
 * @param content - Cover letter text content
 * @param candidateName - Name of the candidate
 * @param companyName - Company name
 * @param jobTitle - Job title
 * @returns PDF buffer
 */
export async function generateCoverLetterPDF(
	content: string,
	candidateName: string,
	companyName: string,
	jobTitle: string
): Promise<PDFGenerationResult> {
	// Convert plain text to formatted HTML
	const formattedContent = content
		.split("\n\n")
		.map((para) => `<p>${para.replaceAll("\n", "<br>")}</p>`)
		.join("");

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Cover Letter - ${candidateName}</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: 'Georgia', 'Times New Roman', serif;
			font-size: 11pt;
			line-height: 1.6;
			color: #333;
			padding: 0.75in;
			max-width: 8.5in;
			margin: 0 auto;
			background: #fff;
		}
		.header {
			margin-bottom: 24px;
			padding-bottom: 16px;
			border-bottom: 1px solid #ddd;
		}
		.name {
			font-size: 18pt;
			font-weight: 700;
			color: #1a1a1a;
			margin-bottom: 4px;
		}
		.meta {
			font-size: 10pt;
			color: #666;
		}
		.content {
			margin-top: 16px;
		}
		.content p {
			margin-bottom: 12px;
			text-align: justify;
		}
		@media print {
			body { padding: 0.5in; }
		}
	</style>
</head>
<body>
	<div class="header">
		<div class="name">${candidateName}</div>
		<div class="meta">Cover Letter for ${jobTitle} at ${companyName}</div>
	</div>
	<div class="content">
		${formattedContent}
	</div>
</body>
</html>`;

	return generatePDFFromHTML(html);
}
