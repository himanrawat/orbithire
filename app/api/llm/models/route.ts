import { NextRequest, NextResponse } from "next/server";
import { testProviderConfig } from "@/lib/ai/providerFactory";
import { getProviderModels } from "@/lib/ai/providers/registry";
import { parseJson } from "@/lib/api";
import { modelLookupSchema } from "@/lib/schemas/api";

type Provider = "openai" | "groq" | "anthropic" | "gemini" | "custom";

export const runtime = "nodejs";

/**
 * POST /api/llm/models - Test connection and fetch available models
 * Returns categorized models from our registry
 */
export async function POST(req: NextRequest) {
	const parsed = await parseJson(req, modelLookupSchema);
	if (!parsed.success) return parsed.response;
	const provider: Provider = parsed.data.provider ?? "openai";
	const apiKey = parsed.data.apiKey;
	const baseURL = parsed.data.baseUrl;

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
