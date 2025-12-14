import {
	S3Client,
	PutObjectCommand,
	HeadObjectCommand,
	GetObjectCommand,
} from "@aws-sdk/client-s3";
import puppeteer from "puppeteer";
import { getR2Config, type R2Config } from "./r2Config";
import { sampleResume } from "./sampleResume";

// Template IDs that we support
export const TEMPLATE_IDS = [
	"standard",
	"professional",
	"even",
	"elegant",
	"flat",
	"spartacus",
	"paper",
	"compact",
	"modern",
] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

// Initialize R2 client
function getR2Client(): { client: S3Client; config: R2Config } | null {
	const config = getR2Config();
	if (!config) return null;

	const client = new S3Client({
		region: "auto",
		endpoint: config.endpoint,
		credentials: {
			accessKeyId: config.accessKeyId,
			secretAccessKey: config.secretAccessKey,
		},
	});

	return { client, config };
}

/**
 * Get the R2 key for a template thumbnail
 */
export function getThumbnailKey(templateId: string): string {
	return `templates/thumbnails/${templateId}.png`;
}

/**
 * Get the R2 key for a template preview HTML
 */
export function getPreviewHtmlKey(templateId: string): string {
	return `templates/previews/${templateId}.html`;
}

/**
 * Get the public URL for a template thumbnail
 * Returns null if R2 is not configured or bucket is private (no publicBaseUrl)
 */
export function getThumbnailUrl(templateId: string): string | null {
	const config = getR2Config();
	if (!config?.publicBaseUrl) return null;
	return `${config.publicBaseUrl}/${getThumbnailKey(templateId)}`;
}

/**
 * Get the public URL for a template preview HTML
 * Returns null if R2 is not configured or bucket is private (no publicBaseUrl)
 */
export function getPreviewHtmlUrl(templateId: string): string | null {
	const config = getR2Config();
	if (!config?.publicBaseUrl) return null;
	return `${config.publicBaseUrl}/${getPreviewHtmlKey(templateId)}`;
}

/**
 * Check if a template thumbnail exists in R2
 */
export async function thumbnailExists(templateId: string): Promise<boolean> {
	const r2 = getR2Client();
	if (!r2) return false;

	try {
		await r2.client.send(
			new HeadObjectCommand({
				Bucket: r2.config.bucket,
				Key: getThumbnailKey(templateId),
			})
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a template preview HTML exists in R2
 */
export async function previewHtmlExists(templateId: string): Promise<boolean> {
	const r2 = getR2Client();
	if (!r2) return false;

	try {
		await r2.client.send(
			new HeadObjectCommand({
				Bucket: r2.config.bucket,
				Key: getPreviewHtmlKey(templateId),
			})
		);
		return true;
	} catch {
		return false;
	}
}

/**
 * Fetch thumbnail from R2 (for proxying through API)
 * Returns the image buffer or null if not found
 */
export async function fetchThumbnail(
	templateId: string
): Promise<Buffer | null> {
	const r2 = getR2Client();
	if (!r2) return null;

	try {
		const response = await r2.client.send(
			new GetObjectCommand({
				Bucket: r2.config.bucket,
				Key: getThumbnailKey(templateId),
			})
		);

		if (!response.Body) return null;

		// Convert stream to buffer
		const chunks: Uint8Array[] = [];
		for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}
		return Buffer.concat(chunks);
	} catch {
		return null;
	}
}

/**
 * Fetch preview HTML from R2 (for proxying through API)
 * Returns the HTML string or null if not found
 */
export async function fetchPreviewHtml(
	templateId: string
): Promise<string | null> {
	const r2 = getR2Client();
	if (!r2) return null;

	try {
		const response = await r2.client.send(
			new GetObjectCommand({
				Bucket: r2.config.bucket,
				Key: getPreviewHtmlKey(templateId),
			})
		);

		if (!response.Body) return null;

		// Convert stream to string
		const chunks: Uint8Array[] = [];
		for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
			chunks.push(chunk);
		}
		return Buffer.concat(chunks).toString("utf-8");
	} catch {
		return null;
	}
}

/**
 * Render a template to HTML using the resume render API
 * This uses the built-in template functions in /api/resume/render
 */
export async function renderTemplateHtml(
	templateId: string,
	baseUrl: string = "http://localhost:3000"
): Promise<string | null> {
	try {
		// Call the resume render API with sample data
		const response = await fetch(`${baseUrl}/api/resume/render`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				resume: sampleResume,
				templateId,
			}),
		});

		if (!response.ok) {
			console.error(
				`Failed to render template ${templateId}: ${response.status}`
			);
			return null;
		}

		const data = (await response.json()) as { html?: string };
		return data.html || null;
	} catch (error) {
		console.error(`Failed to render template ${templateId}:`, error);
		return null;
	}
}

/**
 * Generate a thumbnail image from HTML using Puppeteer
 */
export async function generateThumbnailFromHtml(
	html: string
): Promise<Buffer | null> {
	let browser = null;

	try {
		browser = await puppeteer.launch({
			headless: true,
			args: [
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--disable-dev-shm-usage",
				"--disable-gpu",
			],
		});

		const page = await browser.newPage();

		// Set viewport to letter size at 96 DPI (standard screen resolution)
		await page.setViewport({
			width: 816, // 8.5 inches * 96 DPI
			height: 1056, // 11 inches * 96 DPI
			deviceScaleFactor: 2, // 2x for retina quality
		});

		await page.setContent(html, {
			waitUntil: ["domcontentloaded", "networkidle0"],
		});

		// Take screenshot
		const screenshot = await page.screenshot({
			type: "png",
			fullPage: false, // Only capture viewport (first page)
		});

		return Buffer.from(screenshot);
	} catch (error) {
		console.error("Thumbnail generation error:", error);
		return null;
	} finally {
		if (browser) {
			await browser.close();
		}
	}
}

/**
 * Upload thumbnail to R2
 */
export async function uploadThumbnail(
	templateId: string,
	buffer: Buffer
): Promise<boolean> {
	const r2 = getR2Client();
	if (!r2) return false;

	try {
		await r2.client.send(
			new PutObjectCommand({
				Bucket: r2.config.bucket,
				Key: getThumbnailKey(templateId),
				Body: buffer,
				ContentType: "image/png",
				CacheControl: "public, max-age=31536000", // 1 year cache
			})
		);
		return true;
	} catch (error) {
		console.error(`Failed to upload thumbnail for ${templateId}:`, error);
		return false;
	}
}

/**
 * Upload preview HTML to R2
 */
export async function uploadPreviewHtml(
	templateId: string,
	html: string
): Promise<boolean> {
	const r2 = getR2Client();
	if (!r2) return false;

	try {
		await r2.client.send(
			new PutObjectCommand({
				Bucket: r2.config.bucket,
				Key: getPreviewHtmlKey(templateId),
				Body: Buffer.from(html, "utf-8"),
				ContentType: "text/html; charset=utf-8",
				CacheControl: "public, max-age=31536000", // 1 year cache
			})
		);
		return true;
	} catch (error) {
		console.error(`Failed to upload preview HTML for ${templateId}:`, error);
		return false;
	}
}

/**
 * Generate and upload both thumbnail and preview HTML for a template
 * Returns true if successful
 * @param templateId - The template ID to generate
 * @param force - Force regeneration even if already exists
 * @param baseUrl - Base URL for the API (e.g., http://localhost:3000)
 */
export async function generateAndUploadTemplate(
	templateId: string,
	force: boolean = false,
	baseUrl: string = "http://localhost:3000"
): Promise<{ thumbnail: boolean; preview: boolean }> {
	const result = { thumbnail: false, preview: false };

	// Check if already exists (unless force regenerate)
	if (!force) {
		const [thumbExists, previewExists] = await Promise.all([
			thumbnailExists(templateId),
			previewHtmlExists(templateId),
		]);

		if (thumbExists && previewExists) {
			console.log(`Template ${templateId}: Already exists in R2, skipping`);
			return { thumbnail: true, preview: true };
		}
	}

	console.log(`Template ${templateId}: Generating...`);

	// Render the HTML using the API
	const html = await renderTemplateHtml(templateId, baseUrl);
	if (!html) {
		console.error(`Template ${templateId}: Failed to render HTML`);
		return result;
	}

	// Upload preview HTML
	const previewUploaded = await uploadPreviewHtml(templateId, html);
	result.preview = previewUploaded;
	if (previewUploaded) {
		console.log(`Template ${templateId}: Preview HTML uploaded`);
	}

	// Generate and upload thumbnail
	const thumbnailBuffer = await generateThumbnailFromHtml(html);
	if (thumbnailBuffer) {
		const thumbUploaded = await uploadThumbnail(templateId, thumbnailBuffer);
		result.thumbnail = thumbUploaded;
		if (thumbUploaded) {
			console.log(`Template ${templateId}: Thumbnail uploaded`);
		}
	}

	return result;
}

/**
 * Generate all template thumbnails and previews
 * Only generates missing ones unless force=true
 * @param force - Force regeneration even if already exists
 * @param baseUrl - Base URL for the API (e.g., http://localhost:3000)
 */
export async function generateAllTemplateThumbnails(
	force: boolean = false,
	baseUrl: string = "http://localhost:3000"
): Promise<Map<string, { thumbnail: boolean; preview: boolean }>> {
	const results = new Map<string, { thumbnail: boolean; preview: boolean }>();

	for (const templateId of TEMPLATE_IDS) {
		const result = await generateAndUploadTemplate(templateId, force, baseUrl);
		results.set(templateId, result);
	}

	return results;
}
