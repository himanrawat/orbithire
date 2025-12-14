import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createEdgeSupabaseClient } from "@/lib/supabase-edge";

const PROTECTED_PATHS = [
	"/dashboard",
	"/profile",
	"/generate",
	"/upload",
	"/companies",
	"/resumes",
	"/settings",
];

async function getAuthState(req: NextRequest) {
	const response = NextResponse.next();

	try {
		const supabase = createEdgeSupabaseClient(req, response);
		const { data, error } = await supabase.auth.getUser();
		const authenticated = !error && !!data.user;
		return { authenticated, response };
	} catch {
		return { authenticated: false, response };
	}
}

export async function middleware(req: NextRequest) {
	const path = req.nextUrl.pathname;
	const hostname = req.nextUrl.hostname.toLowerCase();
	const pathWithQuery = `${path}${req.nextUrl.search}`;

	// Never run middleware for API routes - they handle their own auth
	if (path.startsWith("/api")) {
		return NextResponse.next();
	}

	const { authenticated, response } = await getAuthState(req);

	const isProtectedRoute = PROTECTED_PATHS.some(
		(protectedPath) =>
			path === protectedPath || path.startsWith(`${protectedPath}/`)
	);
	const isAuthPage = path === "/signin" || path === "/signup";

	// Protect dashboard host
	if (hostname === "dashboard.himanshurawat.in") {
		if (!authenticated) {
			const redirectUrl = new URL("https://resume.himanshurawat.in");
			redirectUrl.searchParams.set("auth", "required");
			redirectUrl.searchParams.set("redirect", req.nextUrl.href);
			return NextResponse.redirect(redirectUrl);
		}
		return response;
	}

	// Root host redirects based on session
	if (hostname === "himanshurawat.in" || hostname === "www.himanshurawat.in") {
		return NextResponse.redirect(
			new URL(
				authenticated
					? "https://dashboard.himanshurawat.in"
					: "https://resume.himanshurawat.in"
			)
		);
	}

	// Resume host: allow public, but push signed-in users away from auth/landing
	if (hostname === "resume.himanshurawat.in") {
		if (authenticated && (path === "/" || isAuthPage)) {
			return NextResponse.redirect(
				new URL("https://dashboard.himanshurawat.in")
			);
		}
		return response;
	}

	// Local/protected routes: bounce unauthenticated users with redirect param
	if (!authenticated && isProtectedRoute) {
		const redirectUrl = new URL("/signin", req.nextUrl.origin);
		redirectUrl.searchParams.set("redirect", pathWithQuery);
		return NextResponse.redirect(redirectUrl);
	}

	// If signed in and hitting the landing page locally, send to dashboard
	if (authenticated && path === "/") {
		return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
	}

	// If already signed in, keep auth pages gated to dashboard
	if (authenticated && isAuthPage) {
		return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
	}

	return response;
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
