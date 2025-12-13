const requiredKeys = [
	"NEXT_PUBLIC_SUPABASE_URL",
	"NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function requireEnv(key: (typeof requiredKeys)[number]) {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing environment variable: ${key}`);
	}
	return value;
}

const defaultMaxUploadBytes = 5 * 1024 * 1024; // 5MB

export const serverEnv = {
	supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
	supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
	supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
	r2Endpoint: process.env.R2_ENDPOINT || process.env.R2_PUBLIC_BASE_URL,
	r2Bucket: process.env.R2_BUCKET,
	r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
	r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
	r2PublicBaseUrl: process.env.R2_PUBLIC_BASE_URL || process.env.R2_ENDPOINT,
	// Use NEXT_PUBLIC_APP_URL first (for local dev), then SITE_URL (for production)
	siteUrl:
		process.env.NEXT_PUBLIC_APP_URL ||
		process.env.SITE_URL ||
		"http://localhost:3000",
	authCookieDomain:
		process.env.AUTH_COOKIE_DOMAIN ||
		(process.env.NODE_ENV === "production" ? ".himanshurawat.in" : undefined),
	maxUploadBytes:
		parseInt(process.env.MAX_UPLOAD_BYTES || "", 10) || defaultMaxUploadBytes,
};
