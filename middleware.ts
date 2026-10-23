import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createEdgeSupabaseClient } from "@/lib/supabase-edge";
import {
	GPC_COOKIE,
	GPC_COOKIE_MAX_AGE_SECONDS,
	GPC_REQUEST_HEADER,
	hasGpcSignal,
} from "@/lib/privacy/gpc";

const PROTECTED_PATHS = [
	"/dashboard",
	"/profile",
	"/generate",
	"/upload",
	"/companies",
	"/jobs",
	"/resumes",
	"/settings",
	"/documents",
	"/templates",
	"/learn",
	"/onboarding",
	"/focus",
];

// Global Privacy Control: forward the signal to server components and remember it in
// a cookie (readable by client code) so non-essential tracking stays off. See lib/privacy/gpc.ts.
function gpcRequestInit(req: NextRequest) {
	if (!hasGpcSignal(req.headers)) return undefined;
	const headers = new Headers(req.headers);
	headers.set(GPC_REQUEST_HEADER, "1");
	return { request: { headers } };
}

function syncGpcCookie(req: NextRequest, response: NextResponse) {
	if (hasGpcSignal(req.headers)) {
		response.cookies.set(GPC_COOKIE, "1", {
			path: "/",
			sameSite: "lax",
			maxAge: GPC_COOKIE_MAX_AGE_SECONDS,
		});
	} else if (req.cookies.has(GPC_COOKIE)) {
		response.cookies.delete(GPC_COOKIE);
	}
}

async function getAuthState(req: NextRequest) {
	const response = NextResponse.next(gpcRequestInit(req));
	syncGpcCookie(req, response);

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

	// OAuth / MCP discovery documents are public on every host (RFC 8414, RFC 9728)
	if (path.startsWith("/.well-known/")) {
		return NextResponse.next();
	}

	const { authenticated, response } = await getAuthState(req);

	// OAuth consent screen: never framed (clickjacking); the page itself sends
	// signed-out users to /signin and back.
	if (path.startsWith("/oauth/")) {
		response.headers.set("X-Frame-Options", "DENY");
		response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
		if (hostname !== "dashboard.himanshurawat.in") return response;
	}

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

	// Resume host: allow public, but protect routes and push signed-in users away from auth/landing
	if (hostname === "resume.himanshurawat.in") {
		// Block unauthenticated access to protected routes
		if (!authenticated && isProtectedRoute) {
			const redirectUrl = new URL("/signin", req.nextUrl.origin);
			redirectUrl.searchParams.set("redirect", pathWithQuery);
			return NextResponse.redirect(redirectUrl);
		}
		// Redirect authenticated users from landing/auth pages to dashboard
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
