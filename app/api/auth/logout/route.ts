import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";

async function handleSignOut(req: NextRequest) {
	const origin = req.nextUrl?.origin || serverEnv.siteUrl;
	const response = NextResponse.redirect(new URL("/", origin));

	// Let Supabase SSR handle all cookie management automatically
	const supabase = createServerClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseAnonKey,
		{
			cookies: {
				get(name: string) {
					return req.cookies.get(name)?.value;
				},
				set(name: string, value: string, options: any) {
					response.cookies.set({ name, value, ...options });
				},
				remove(name: string, options: any) {
					response.cookies.set({ name, value: "", ...options });
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
