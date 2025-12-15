/**
 * Edge-safe Supabase client for middleware.
 *
 * This module is specifically designed for Edge Runtime compatibility.
 * It does NOT throw on missing env vars at module load time - instead
 * it returns undefined values and lets the caller handle missing config.
 *
 * DO NOT import serverEnv or any Node-only modules here.
 */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Edge-safe environment configuration.
 * Returns empty strings if env vars are missing (caller must handle).
 */
const edgeEnv = {
	get supabaseUrl() {
		return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
	},
	get supabaseAnonKey() {
		return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
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
};

/**
 * Create a Supabase client for use in Edge middleware.
 * Uses @supabase/ssr which is Edge-compatible.
 */
export function createEdgeSupabaseClient(req: NextRequest, res: NextResponse) {
	return createServerClient(edgeEnv.supabaseUrl, edgeEnv.supabaseAnonKey, {
		cookies: {
			get(name: string) {
				return req.cookies.get(name)?.value;
			},
			set(name: string, value: string, options: CookieOptions) {
				res.cookies.set({
					name,
					value,
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
					...(edgeEnv.authCookieDomain && { domain: edgeEnv.authCookieDomain }),
					...options,
				});
			},
			remove(name: string, options: CookieOptions) {
				res.cookies.set({
					name,
					value: "",
					expires: new Date(0),
					httpOnly: true,
					secure: isProduction,
					sameSite: "lax",
					path: "/",
					...(edgeEnv.authCookieDomain && { domain: edgeEnv.authCookieDomain }),
					...options,
				});
			},
		},
	});
}
