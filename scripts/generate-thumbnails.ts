#!/usr/bin/env node
/**
 * Generate template thumbnails and preview HTML
 *
 * Usage:
 *   npx ts-node scripts/generate-thumbnails.ts
 *   npx ts-node scripts/generate-thumbnails.ts --force  # Force regenerate all
 *
 * This script is run as part of the build process to pre-generate
 * template thumbnails and cache them to R2.
 */

// Load .env file (ts-node doesn't load it automatically like Next.js does)
import * as dotenv from "dotenv";
dotenv.config();

import {
	TEMPLATE_IDS,
	generateAllTemplateThumbnails,
} from "../lib/templateThumbnails";
import { isR2Configured } from "../lib/r2Config";

async function main() {
	console.log("🎨 Template Thumbnail Generator\n");

	// Check if R2 is configured
	if (!isR2Configured()) {
		console.log("⚠️  R2 is not configured. Skipping thumbnail generation.");
		console.log(
			"   Set R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_PUBLIC_BASE_URL"
		);
		console.log("   Thumbnails will be generated on-demand instead.\n");
		process.exit(0);
	}

	const force = process.argv.includes("--force");

	if (force) {
		console.log("🔄 Force mode: Regenerating all templates\n");
	} else {
		console.log("📦 Incremental mode: Only generating missing templates\n");
	}

	console.log(`Templates to process: ${TEMPLATE_IDS.join(", ")}\n`);

	const results = await generateAllTemplateThumbnails(force);

	// Summary
	console.log("\n📊 Summary:");
	console.log("─".repeat(50));

	let successCount = 0;
	let failCount = 0;

	for (const [templateId, result] of results) {
		const thumbStatus = result.thumbnail ? "✅" : "❌";
		const previewStatus = result.preview ? "✅" : "❌";

		if (result.thumbnail && result.preview) {
			successCount++;
		} else {
			failCount++;
		}

		console.log(
			`  ${templateId.padEnd(
				15
			)} Thumbnail: ${thumbStatus}  Preview: ${previewStatus}`
		);
	}

	console.log("─".repeat(50));
	console.log(`  ✅ Success: ${successCount}  ❌ Failed: ${failCount}\n`);

	if (failCount > 0) {
		console.log(
			"⚠️  Some templates failed. They will be generated on-demand.\n"
		);
	}

	process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
