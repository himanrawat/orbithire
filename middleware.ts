import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "./lib/config";

const PROTECTED_PATHS = ["/dashboard", "/onboarding", "/profile"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({
            name,
            value,
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            domain: serverEnv.authCookieDomain,
            path: "/",
            ...options
          });
        },
        remove(name: string, options: any) {
          res.cookies.set({
            name,
            value: "",
            expires: new Date(0),
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            domain: serverEnv.authCookieDomain,
            path: "/",
            ...options
          });
        }
      }
    }
  );

  const {
    data: { session }
  } = await supabase.auth.getSession();

  const hostname = req.nextUrl.hostname.toLowerCase();
  const path = req.nextUrl.pathname;
  const pathWithQuery = `${path}${req.nextUrl.search}`;
  const isProtectedRoute = PROTECTED_PATHS.some(
    (protectedPath) => path === protectedPath || path.startsWith(`${protectedPath}/`)
  );

  // Protect dashboard host
  if (hostname === "dashboard.himanshurawat.in") {
    if (!session) {
      const redirectUrl = new URL("https://resume.himanshurawat.in");
      redirectUrl.searchParams.set("auth", "required");
      redirectUrl.searchParams.set("redirect", req.nextUrl.href);
      return NextResponse.redirect(redirectUrl, { headers: res.headers });
    }
    return res;
  }

  // Root host redirects based on session
  if (hostname === "himanshurawat.in" || hostname === "www.himanshurawat.in") {
    const redirectUrl = new URL(session ? "https://dashboard.himanshurawat.in" : "https://resume.himanshurawat.in");
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  // Resume host: allow public, optionally auto-redirect to dashboard if already authed on key entry points
  if (hostname === "resume.himanshurawat.in") {
    if (session && (path === "/" || path === "/signin" || path === "/signup")) {
      return NextResponse.redirect(new URL("https://dashboard.himanshurawat.in"), { headers: res.headers });
    }
    return res;
  }

  // Local/protected routes: bounce unauthenticated users with redirect param
  if (!session && isProtectedRoute) {
    const redirectUrl = new URL("/signin", req.nextUrl.origin);
    redirectUrl.searchParams.set("redirect", pathWithQuery);
    return NextResponse.redirect(redirectUrl, { headers: res.headers });
  }

  // Default: continue
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
