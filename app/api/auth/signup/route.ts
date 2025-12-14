import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json().catch(() => ({ email: "", password: "" }));

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    // Debug: Check if env vars are available
    let supabaseUrl: string;
    let supabaseAnonKey: string;
    try {
      supabaseUrl = serverEnv.supabaseUrl;
      supabaseAnonKey = serverEnv.supabaseAnonKey;
    } catch (envError: any) {
      console.error("[signup] Environment error:", envError.message);
      return NextResponse.json({ error: "Server configuration error", details: envError.message }, { status: 500 });
    }

    const response = NextResponse.json({ ok: true });

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({
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
            response.cookies.set({
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.SITE_URL || "https://resume.himanshurawat.in"
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: response.headers });
    }

    return response;
  } catch (err: any) {
    console.error("[signup] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error", details: err.message }, { status: 500 });
  }
}
