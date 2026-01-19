import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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

/**
 * Service-role Supabase client for privileged admin/server tasks.
 * Bypasses RLS, so only use in trusted server contexts.
 */
export function createServiceSupabase() {
  const serviceRoleKey = serverEnv.supabaseServiceRoleKey;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  }

  return createClient(serverEnv.supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
