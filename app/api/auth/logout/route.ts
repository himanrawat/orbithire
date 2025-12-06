import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const cookieDomain = process.env.NODE_ENV === "production" ? ".himanshurawat.in" : undefined;

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect("https://himanshurawat.in");

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            domain: cookieDomain,
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
            domain: cookieDomain,
            path: "/",
            ...options
          });
        }
      }
    }
  );

  await supabase.auth.signOut();

  return response;
}
