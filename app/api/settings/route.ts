import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { serverEnv } from "@/lib/config";
import { getProvider } from "@/lib/ai/providers/registry";
import { autoUpgradeDeprecatedModel } from "@/lib/ai/modelUpgrade";
import { encryptApiKey } from "@/lib/encryption";

export const runtime = "nodejs";

interface SettingsPayload {
	provider: "openai" | "groq" | "anthropic" | "gemini" | "custom";
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

	// If no settings exist, return defaults with quota info
	if (!settings) {
		// Get quota for new user (no settings yet)
		const { data: quotaData } = await supabase.rpc("check_generation_quota", {
			p_user_id: user.id,
		});

		return NextResponse.json({
			provider: "groq",
			hasApiKey: false,
			baseUrl: null,
			defaultModel: null,
			connectionVerified: false,
			defaultTemplate: "modern",
			defaultCountry: "US",
			deprecationWarning: null,
			quota: quotaData || {
				used: 0,
				limit: 2,
				remaining: 2,
				has_own_key: false,
			},
		});
	}

	// Check for deprecated model and auto-upgrade
	let deprecationWarning: string | null = null;
	let currentModel = settings.ai_default_model;
	let upgradedModel: string | null = null;

	if (settings.ai_provider && settings.ai_default_model) {
		const upgradeResult = autoUpgradeDeprecatedModel(
			settings.ai_provider,
			settings.ai_default_model
		);

		if (upgradeResult.wasDeprecated) {
			deprecationWarning = upgradeResult.message || null;
			upgradedModel = upgradeResult.upgradedModel || null;

			// Auto-upgrade the model in database
			if (upgradedModel) {
				await supabase
					.from("user_settings")
					.update({ ai_default_model: upgradedModel })
					.eq("user_id", user.id);

				currentModel = upgradedModel;
			}
		}
	}

	// Get quota information
	const { data: quotaData } = await supabase.rpc("check_generation_quota", {
		p_user_id: user.id,
	});

	return NextResponse.json({
		provider: settings.ai_provider || "groq",
		hasApiKey: !!settings.ai_api_key_encrypted,
		// Mask the API key - only show last 4 chars
		apiKeyPreview: settings.ai_api_key_encrypted
			? `...${settings.ai_api_key_encrypted.slice(-4)}`
			: null,
		baseUrl: settings.ai_base_url,
		defaultModel: currentModel,
		connectionVerified: settings.ai_connection_verified,
		lastVerifiedAt: settings.ai_last_verified_at,
		defaultTemplate: settings.default_template,
		defaultCountry: settings.default_country,
		deprecationWarning,
		wasAutoUpgraded: !!upgradedModel,
		quota: quotaData || {
			used: settings.free_generations_used || 0,
			limit: 2,
			remaining: Math.max(0, 2 - (settings.free_generations_used || 0)),
			has_own_key: !!settings.ai_api_key_encrypted,
		},
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

	// Validate provider exists in registry
	const providerConfig = getProvider(provider);
	if (!providerConfig && provider !== "custom") {
		return NextResponse.json(
			{
				error: `Invalid provider: ${provider}. Valid providers are: openai, groq, anthropic, gemini, custom`,
			},
			{ status: 400 }
		);
	}

	// Build update object
	const updateData: Record<string, unknown> = {
		user_id: user.id,
		ai_provider: provider,
		updated_at: new Date().toISOString(),
	};

	// Only update API key if provided (allows clearing by passing empty string)
	if (apiKey !== undefined) {
		// Encrypt the API key before storing
		updateData.ai_api_key_encrypted = apiKey ? encryptApiKey(apiKey) : null;
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
