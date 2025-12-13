import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

interface SettingsPayload {
	provider: "openai" | "groq" | "custom";
	apiKey?: string;
	baseUrl?: string;
	defaultModel?: string;
}

/**
 * GET /api/settings - Fetch user settings
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
		.select("*")
		.eq("user_id", user.id)
		.single();

	if (settingsError && settingsError.code !== "PGRST116") {
		// PGRST116 = no rows returned
		console.error("Settings fetch error:", settingsError);
		return NextResponse.json(
			{ error: "Failed to fetch settings" },
			{ status: 500 }
		);
	}

	// If no settings exist, return defaults
	if (!settings) {
		return NextResponse.json({
			provider: "groq",
			hasApiKey: false,
			baseUrl: null,
			defaultModel: null,
			connectionVerified: false,
			defaultTemplate: "modern",
			defaultCountry: "US",
		});
	}

	return NextResponse.json({
		provider: settings.ai_provider || "groq",
		hasApiKey: !!settings.ai_api_key_encrypted,
		// Mask the API key - only show last 4 chars
		apiKeyPreview: settings.ai_api_key_encrypted
			? `...${settings.ai_api_key_encrypted.slice(-4)}`
			: null,
		baseUrl: settings.ai_base_url,
		defaultModel: settings.ai_default_model,
		connectionVerified: settings.ai_connection_verified,
		lastVerifiedAt: settings.ai_last_verified_at,
		defaultTemplate: settings.default_template,
		defaultCountry: settings.default_country,
	});
}

/**
 * POST /api/settings - Save user settings
 */
export async function POST(req: NextRequest) {
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

	let body: SettingsPayload;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { provider, apiKey, baseUrl, defaultModel } = body;

	// Build update object
	const updateData: Record<string, unknown> = {
		user_id: user.id,
		ai_provider: provider,
		updated_at: new Date().toISOString(),
	};

	// Only update API key if provided (allows clearing by passing empty string)
	if (apiKey !== undefined) {
		// In production, you'd encrypt this with a proper encryption library
		// For now, we store it as-is but it's protected by RLS
		updateData.ai_api_key_encrypted = apiKey || null;
	}

	if (baseUrl !== undefined) {
		updateData.ai_base_url = baseUrl || null;
	}

	if (defaultModel !== undefined) {
		updateData.ai_default_model = defaultModel || null;
	}

	// Upsert settings
	const { data: settings, error: upsertError } = await supabase
		.from("user_settings")
		.upsert(updateData, {
			onConflict: "user_id",
		})
		.select()
		.single();

	if (upsertError) {
		console.error("Settings save error:", upsertError);
		return NextResponse.json(
			{ error: "Failed to save settings" },
			{ status: 500 }
		);
	}

	return NextResponse.json({
		success: true,
		provider: settings.ai_provider,
		hasApiKey: !!settings.ai_api_key_encrypted,
	});
}

/**
 * PATCH /api/settings - Update connection status after verification
 */
export async function PATCH(req: NextRequest) {
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

	let body: { verified: boolean };
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { error: updateError } = await supabase
		.from("user_settings")
		.update({
			ai_connection_verified: body.verified,
			ai_last_verified_at: body.verified ? new Date().toISOString() : null,
		})
		.eq("user_id", user.id);

	if (updateError) {
		console.error("Settings update error:", updateError);
		return NextResponse.json(
			{ error: "Failed to update verification status" },
			{ status: 500 }
		);
	}

	return NextResponse.json({ success: true, verified: body.verified });
}
