/**
 * Helper to get required environment variables.
 * Throws when the property is accessed (not at module load time).
 */
function getRequiredEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing environment variable: ${key}`);
	}
	return value;
}

const defaultMaxUploadBytes = 5 * 1024 * 1024; // 5MB

/**
 * Server environment configuration.
 * Uses lazy getters to avoid throwing at module load time.
 * This is critical for Amplify/Vercel where env vars might not be
 * available during the build phase but are available at runtime.
 */
export const serverEnv = {
	get supabaseUrl() {
		return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
	},
	get supabaseAnonKey() {
		return getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
	},
	get supabaseServiceRoleKey() {
		return process.env.SUPABASE_SERVICE_ROLE_KEY;
	},
	get r2Endpoint() {
		return process.env.R2_ENDPOINT || process.env.R2_PUBLIC_BASE_URL;
	},
	get r2Bucket() {
		return process.env.R2_BUCKET;
	},
	get r2AccessKeyId() {
		return process.env.R2_ACCESS_KEY_ID;
	},
	get r2SecretAccessKey() {
		return process.env.R2_SECRET_ACCESS_KEY;
	},
	get r2PublicBaseUrl() {
		return process.env.R2_PUBLIC_BASE_URL || process.env.R2_ENDPOINT;
	},
	// In production, require SITE_URL to be set. In development, allow localhost fallback.
	get siteUrl() {
		const devAmplifyUrl = "https://dev.d1pqsq7ljwpxt9.amplifyapp.com";
		const url =
			process.env.NEXT_PUBLIC_APP_URL ||
			process.env.SITE_URL ||
			process.env.NEXT_PUBLIC_SITE_URL;

		if (!url) {
			// Allow dev branch to fall back to the hosted preview domain
			if (process.env.AMPLIFY_BRANCH === "dev") {
				return devAmplifyUrl;
			}
			if (process.env.NODE_ENV === "production") {
				throw new Error(
					"Missing SITE_URL, NEXT_PUBLIC_APP_URL, or NEXT_PUBLIC_SITE_URL in production"
				);
			}
			return "http://localhost:3000";
		}
		return url;
	},
	get authCookieDomain() {
		// Only set cookie domain in production to allow localhost development
		if (process.env.NODE_ENV !== "production") {
			return undefined;
		}
		// Don't set cookie domain on Amplify preview/dev branches (amplifyapp.com domains)
		// as they're not subdomains of .himanshurawat.in
		if (process.env.AMPLIFY_BRANCH && process.env.AMPLIFY_BRANCH !== "master") {
			return undefined;
		}
		return process.env.AUTH_COOKIE_DOMAIN || ".himanshurawat.in";
	},
	get maxUploadBytes() {
		return (
			parseInt(process.env.MAX_UPLOAD_BYTES || "", 10) || defaultMaxUploadBytes
		);
	},
};
