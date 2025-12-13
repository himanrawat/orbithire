import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

/**
 * GET /api/settings/apikey - Get decrypted API key for internal use
 * This endpoint is meant to be called by other API routes, not directly by clients
 */
export async function GET(req: NextRequest) {
	const supabase = createServerClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseAnonKey,
		{
			cookies: {
				get(name: string) {
					return req.cookies.get(name)?.value;
				},
				set() {},
				remove() {},
			},
		}
	);

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
	}

	// Fetch user settings
	const { data: settings, error: settingsError } = await supabase
		.from("user_settings")
		.select("ai_provider, ai_api_key_encrypted, ai_base_url, ai_default_model")
		.eq("user_id", user.id)
		.single();

	if (settingsError && settingsError.code !== "PGRST116") {
		console.error("Settings fetch error:", settingsError);
		return NextResponse.json(
			{ error: "Failed to fetch settings" },
			{ status: 500 }
		);
	}

	// Determine API key and base URL
	const provider = settings?.ai_provider || "groq";
	let apiKey = settings?.ai_api_key_encrypted || null;
	let baseUrl = settings?.ai_base_url || null;
	let model = settings?.ai_default_model || null;

	// If user doesn't have a key, fall back to environment variables
	if (!apiKey) {
		if (provider === "groq" && process.env.GROQ_API_KEY) {
			apiKey = process.env.GROQ_API_KEY;
			baseUrl = "https://api.groq.com/openai/v1";
			model = model || "llama-3.1-70b-versatile";
		} else if (provider === "openai" && process.env.OPENAI_API_KEY) {
			apiKey = process.env.OPENAI_API_KEY;
			baseUrl = process.env.OPENAI_BASE_URL || null;
			model = model || "gpt-4o-mini";
		}
	} else {
		// User has their own key, set default baseUrl and model based on provider
		if (provider === "groq" && !baseUrl) {
			baseUrl = "https://api.groq.com/openai/v1";
			model = model || "llama-3.1-70b-versatile";
		} else if (provider === "openai" && !baseUrl) {
			baseUrl = null; // OpenAI client uses default
			model = model || "gpt-4o-mini";
		}
		// For custom provider, baseUrl must be set by user
	}

	if (!apiKey) {
		return NextResponse.json(
			{
				error: "No API key configured. Please add your API key in Settings.",
				needsSetup: true,
			},
			{ status: 400 }
		);
	}

	return NextResponse.json({
		provider,
		apiKey,
		baseUrl,
		model,
		isUserKey: !!settings?.ai_api_key_encrypted,
	});
}
