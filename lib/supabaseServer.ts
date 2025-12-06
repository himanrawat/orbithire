import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const cookieDomain = process.env.NODE_ENV === "production" ? ".himanshurawat.in" : undefined;

/**
 * Server-side Supabase client that reads/writes the auth cookie shared across subdomains.
 */
export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          return cookie ? cookie.value : null;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({
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
          cookieStore.set({
            name,
            value: "",
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            domain: cookieDomain,
            path: "/",
            expires: new Date(0),
            ...options
          });
        }
      }
    }
  );
}
