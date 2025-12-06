import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

type Provider = "openai" | "groq" | "custom";

export const runtime = "nodejs";

function getDefaults(provider: Provider, baseUrl?: string) {
	if (provider === "groq") {
		return {
			baseURL: baseUrl || "https://api.groq.com/openai/v1",
			fallbackKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "",
		};
	}

	if (provider === "custom") {
		return {
			baseURL: baseUrl || "",
			fallbackKey: "",
		};
	}

	return {
		baseURL: baseUrl || process.env.OPENAI_BASE_URL || undefined,
		fallbackKey: process.env.OPENAI_API_KEY || "",
	};
}

export async function POST(req: NextRequest) {
	const body = (await req.json().catch(() => null)) || {};
	const provider: Provider = body.provider || "openai";
	const apiKey: string | undefined = body.apiKey;
	const baseURL: string | undefined = body.baseUrl;

	const defaults = getDefaults(provider, baseURL);
	const resolvedKey = apiKey || defaults.fallbackKey;

	if (!resolvedKey) {
		return NextResponse.json(
			{ error: "API key is required (provided in request or env)." },
			{ status: 400 }
		);
	}

	try {
		const client = new OpenAI({
			apiKey: resolvedKey,
			baseURL: defaults.baseURL,
		});

		const modelsResponse = await client.models.list();
		const models =
			modelsResponse.data?.map((m: any) => ({
				id: m.id,
				owned_by: m.owned_by,
			})) || [];

		return NextResponse.json({
			ok: true,
			provider,
			baseURL: defaults.baseURL,
			models,
			// Token quota is generally not exposed by providers; return null to reflect that.
			tokenInfo: null,
		});
	} catch (error) {
		console.error("Model fetch error:", error);
		return NextResponse.json(
			{ error: "Unable to fetch models with the provided key/base URL." },
			{ status: 500 }
		);
	}
}
