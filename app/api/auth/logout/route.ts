import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";

async function handleSignOut(req: NextRequest) {
  const origin = req.nextUrl?.origin || serverEnv.siteUrl || "http://localhost:3000";
  const response = NextResponse.redirect(new URL("/", origin));

  const supabase = createServerClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
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
            ...options,
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
            ...options,
          });
        },
      },
    }
  );

  await supabase.auth.signOut();

  return response;
}

export async function POST(req: NextRequest) {
  return handleSignOut(req);
}

export async function GET(req: NextRequest) {
  return handleSignOut(req);
}
