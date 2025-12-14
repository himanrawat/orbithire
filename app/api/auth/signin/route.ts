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

		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});

		if (error) {
			return NextResponse.json({ error: error.message }, { status: 401 });
		}

		return response;
	} catch (err: any) {
		console.error("[signin] Error:", err);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
