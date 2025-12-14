import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
	createEdgeSupabaseClient,
	isEdgeConfigured,
	edgeEnv,
} from "./lib/supabase-edge";

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

export async function middleware(req: NextRequest) {
	const res = NextResponse.next();
	const path = req.nextUrl.pathname;
	const hostname = req.nextUrl.hostname.toLowerCase();
	const pathWithQuery = `${path}${req.nextUrl.search}`;

	// Edge-safe: Check if Supabase is configured before proceeding
	if (!isEdgeConfigured()) {
		// In development, log and continue. In production, this should not happen.
		console.error(
			"[Middleware] Missing Supabase env vars. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
		);
		// Allow the request to continue - API routes will handle auth properly
		return res;
	}

	const supabase = createEdgeSupabaseClient(req, res);

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const isProtectedRoute = PROTECTED_PATHS.some(
		(protectedPath) =>
			path === protectedPath || path.startsWith(`${protectedPath}/`)
	);
	const isAuthPage = path === "/signin" || path === "/signup";

	// Protect dashboard host
	if (hostname === "dashboard.himanshurawat.in") {
		if (!user) {
			const redirectUrl = new URL("https://resume.himanshurawat.in");
			redirectUrl.searchParams.set("auth", "required");
			redirectUrl.searchParams.set("redirect", req.nextUrl.href);
			return NextResponse.redirect(redirectUrl, { headers: res.headers });
		}
		return res;
	}

	// Root host redirects based on session
	if (hostname === "himanshurawat.in" || hostname === "www.himanshurawat.in") {
		const redirectUrl = new URL(
			user
				? "https://dashboard.himanshurawat.in"
				: "https://resume.himanshurawat.in"
		);
		return NextResponse.redirect(redirectUrl, { headers: res.headers });
	}

	// Resume host: allow public, auto-redirect signed-in users away from auth pages
	if (hostname === "resume.himanshurawat.in") {
		if (user && (path === "/" || isAuthPage)) {
			return NextResponse.redirect(
				new URL("https://dashboard.himanshurawat.in"),
				{
					headers: res.headers,
				}
			);
		}
		return res;
	}

	// Local/protected routes: bounce unauthenticated users with redirect param
	if (!user && isProtectedRoute) {
		const redirectUrl = new URL("/signin", req.nextUrl.origin);
		redirectUrl.searchParams.set("redirect", pathWithQuery);
		return NextResponse.redirect(redirectUrl, { headers: res.headers });
	}

	// If signed in and hitting the landing page locally, send to dashboard
	if (user && path === "/") {
		return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin), {
			headers: res.headers,
		});
	}

	// If already signed in, keep auth pages gated to dashboard
	if (user && isAuthPage) {
		return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin), {
			headers: res.headers,
		});
	}

	// Default: continue
	return res;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
