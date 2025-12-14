import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";

export async function POST(req: NextRequest) {
	try {
		const { email, password } = await req
			.json()
			.catch(() => ({ email: "", password: "" }));

		if (!email || !password) {
			return NextResponse.json(
				{ error: "Email and password are required." },
				{ status: 400 }
			);
		}

		const response = NextResponse.json({ ok: true });

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

		// Use production URL for email confirmation in production, localhost in dev
		const emailRedirectTo =
			process.env.NODE_ENV === "production"
				? "https://resume.himanshurawat.in/signin"
				: `${serverEnv.siteUrl}/signin`;

		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo,
			},
		});

		if (error) {
			console.error("[signup] Supabase error:", error);
			return NextResponse.json({ error: error.message }, { status: 400 });
		}

		// Debug logging
		console.log("[signup] Supabase response:", {
			hasSession: !!data.session,
			hasUser: !!data.user,
			userConfirmedAt: data.user?.confirmed_at,
		});

		// If session exists, user is signed in immediately (email confirmation disabled)
		// Otherwise, they need to confirm their email first
		const requiresEmailConfirmation = !data.session;

		return NextResponse.json(
			{ ok: true, requiresEmailConfirmation },
			{ status: 200 }
		);
	} catch (err: any) {
		console.error("[signup] Error:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
