import { NextRequest, NextResponse } from "next/server";
import { createProvider, testProviderConfig } from "@/lib/ai/providerFactory";
import { getProviderModels, type ModelInfo } from "@/lib/ai/providers/registry";

type Provider = "openai" | "groq" | "anthropic" | "gemini" | "custom";

export const runtime = "nodejs";

/**
 * POST /api/llm/models - Test connection and fetch available models
 * Returns categorized models from our registry
 */
export async function POST(req: NextRequest) {
	const body = (await req.json().catch(() => null)) || {};
	const provider: Provider = body.provider || "openai";
	const apiKey: string | undefined = body.apiKey;
	const baseURL: string | undefined = body.baseUrl;

	if (!apiKey) {
		return NextResponse.json(
			{ error: "API key is required" },
			{ status: 400 }
		);
	}

	// Test the provider configuration
	const testResult = await testProviderConfig({
		provider,
		apiKey,
		baseURL,
	});

	if (!testResult.success) {
		return NextResponse.json(
			{
				error: testResult.error || "Failed to connect to provider",
				ok: false,
			},
			{ status: 400 }
		);
	}

	// Get categorized models from registry
	const allModels = getProviderModels(provider);

	// Categorize models
	const categorized = {
		recommended: allModels.filter((m) => m.category === "recommended"),
		alternative: allModels.filter((m) => m.category === "alternative"),
		experimental: allModels.filter((m) => m.category === "experimental"),
		deprecated: allModels.filter((m) => m.category === "deprecated"),
		specialized: allModels.filter((m) => m.category === "specialized"),
	};

	return NextResponse.json({
		ok: true,
		provider,
		models: allModels,
		categorized,
	});
}
