import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const cookieDomain = process.env.NODE_ENV === "production" ? ".himanshurawat.in" : undefined;

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            domain: cookieDomain,
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
            domain: cookieDomain,
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

  // Protect dashboard host
  if (hostname === "dashboard.himanshurawat.in") {
    if (!session) {
      const redirectUrl = new URL("https://resume.himanshurawat.in");
      redirectUrl.searchParams.set("auth", "required");
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

  // Default: continue
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
