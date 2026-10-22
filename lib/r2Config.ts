/**
 * R2 Storage configuration
 *
 * This is a standalone config file that reads R2 environment variables
 * directly without depending on other app config (like Supabase).
 */

export interface R2Config {
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	publicBaseUrl?: string; // Optional - only needed for public bucket access
}

/**
 * Get R2 configuration from environment variables.
 * Returns null if R2 is not configured.
 */
export function getR2Config(): R2Config | null {
	const endpoint =
		process.env.R2_ENDPOINT ||
		(process.env.R2_ACCOUNT_ID
			? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
			: undefined);
	const bucket = process.env.R2_BUCKET;
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL; // Optional for private buckets

	// Core fields required for R2 to work (publicBaseUrl is optional)
	if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
		return null;
	}

	return {
		endpoint,
		bucket,
		accessKeyId,
		secretAccessKey,
		publicBaseUrl, // May be undefined for private buckets
	};
}

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
	return getR2Config() !== null;
}
