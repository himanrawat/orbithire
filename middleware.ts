import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
	"/dashboard",
	"/profile",
	"/onboarding",
	"/generate",
	"/upload",
	"/companies",
	"/resumes",
	"/settings",
];

/**
 * Fast cookie-presence check for session detection.
 * Real validation happens in server/API routes.
 * Only checks for Supabase cookies (sb-*), ignores Cloudflare (cf_*) etc.
 */
function hasSupabaseSessionCookie(req: NextRequest): boolean {
	// Check for standard Supabase auth cookies
	const hasStandardCookie =
		!!req.cookies.get("sb-access-token")?.value ||
		!!req.cookies.get("sb-refresh-token")?.value;

	if (hasStandardCookie) return true;

	// Fallback: check for project-specific Supabase cookies (sb-<ref>-auth-token)
	const allCookies = req.cookies.getAll();
	return allCookies.some(
		(cookie) =>
			cookie.name.startsWith("sb-") &&
			(cookie.name.includes("-auth-token") ||
				cookie.name.includes("-access-token") ||
				cookie.name.includes("-refresh-token"))
	);
}

export function middleware(req: NextRequest) {
	const path = req.nextUrl.pathname;
	const hostname = req.nextUrl.hostname.toLowerCase();
	const pathWithQuery = `${path}${req.nextUrl.search}`;

	// ✅ Critical: never run middleware for API routes - they handle their own auth
	if (path.startsWith("/api")) {
		return NextResponse.next();
	}

	const isProtectedRoute = PROTECTED_PATHS.some(
		(protectedPath) =>
			path === protectedPath || path.startsWith(`${protectedPath}/`)
	);
	const isAuthPage = path === "/signin" || path === "/signup";

	// "best-effort" session detection (real validation happens in server/API routes)
	const maybeSignedIn = hasSupabaseSessionCookie(req);

	// Protect dashboard host
	if (hostname === "dashboard.himanshurawat.in") {
		if (!maybeSignedIn) {
			const redirectUrl = new URL("https://resume.himanshurawat.in");
			redirectUrl.searchParams.set("auth", "required");
			redirectUrl.searchParams.set("redirect", req.nextUrl.href);
			return NextResponse.redirect(redirectUrl);
		}
		return NextResponse.next();
	}

	// Root host redirects based on session
	if (hostname === "himanshurawat.in" || hostname === "www.himanshurawat.in") {
		return NextResponse.redirect(
			new URL(
				maybeSignedIn
					? "https://dashboard.himanshurawat.in"
					: "https://resume.himanshurawat.in"
			)
		);
	}

	// Resume host: allow public, but push signed-in users away from auth/landing
	if (hostname === "resume.himanshurawat.in") {
		if (maybeSignedIn && (path === "/" || isAuthPage)) {
			return NextResponse.redirect(
				new URL("https://dashboard.himanshurawat.in")
			);
		}
		return NextResponse.next();
	}

	// Local/protected routes: bounce unauthenticated users with redirect param
	if (!maybeSignedIn && isProtectedRoute) {
		const redirectUrl = new URL("/signin", req.nextUrl.origin);
		redirectUrl.searchParams.set("redirect", pathWithQuery);
		return NextResponse.redirect(redirectUrl);
	}

	// If signed in and hitting the landing page locally, send to dashboard
	if (maybeSignedIn && path === "/") {
		return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
	}

	// If already signed in, keep auth pages gated to dashboard
	if (maybeSignedIn && isAuthPage) {
		return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
