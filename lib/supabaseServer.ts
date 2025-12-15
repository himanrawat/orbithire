import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "./config";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Server-side Supabase client that reads/writes the auth cookie shared across subdomains.
 */
export function createServerSupabase() {
  const cookieStore = cookies();

  return createServerClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
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
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            ...(serverEnv.authCookieDomain && { domain: serverEnv.authCookieDomain }),
            ...options
          });
        },
        remove(name: string, options: any) {
          cookieStore.set({
            name,
            value: "",
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
            expires: new Date(0),
            ...(serverEnv.authCookieDomain && { domain: serverEnv.authCookieDomain }),
            ...options
          });
        }
      }
    }
  );
}
