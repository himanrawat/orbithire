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

/**
 * Edge-safe environment configuration.
 * Returns empty strings if env vars are missing (caller must handle).
 */
export const edgeEnv = {
	get supabaseUrl() {
		return process.env.NEXT_PUBLIC_SUPABASE_URL || "";
	},
	get supabaseAnonKey() {
		return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
	},
	get authCookieDomain() {
		return (
			process.env.AUTH_COOKIE_DOMAIN ||
			(process.env.NODE_ENV === "production" ? ".himanshurawat.in" : undefined)
		);
	},
};

/**
 * Check if required edge environment variables are configured.
 */
export function isEdgeConfigured(): boolean {
	return !!(edgeEnv.supabaseUrl && edgeEnv.supabaseAnonKey);
}

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
					secure: true,
					sameSite: "lax",
					domain: edgeEnv.authCookieDomain,
					path: "/",
					...options,
				});
			},
			remove(name: string, options: CookieOptions) {
				res.cookies.set({
					name,
					value: "",
					expires: new Date(0),
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					domain: edgeEnv.authCookieDomain,
					path: "/",
					...options,
				});
			},
		},
	});
}
