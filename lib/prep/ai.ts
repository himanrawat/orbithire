/**
 * Server-only: runs the practice feedback through the user's AI provider (their own key
 * from user_settings, else the platform key), the same resolution the resume generator uses.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createProvider } from "@/lib/ai/providerFactory";
import { ProviderError, ProviderErrorType, type ProviderInitConfig } from "@/lib/ai/providers/baseProvider";
import { decryptApiKey } from "@/lib/encryption";
import type { PrepFeedback, PrepQuestion } from "./constants";
import { FEEDBACK_SYSTEM_PROMPT, buildFeedbackPrompt, parseFeedback } from "./feedback";

const DEFAULT_MODELS: Readonly<Record<string, string>> = {
	groq: "llama-3.3-70b-versatile",
	openai: "gpt-4o-mini",
	anthropic: "claude-3-5-sonnet-20241022",
	gemini: "gemini-1.5-flash",
};

const FEEDBACK_TIMEOUT_MS = 45_000;

type SettingsRow = {
	ai_provider: string | null;
	ai_api_key_encrypted: string | null;
	ai_base_url: string | null;
	ai_default_model: string | null;
};

function platformConfig(provider: string, model: string | undefined): ProviderInitConfig | null {
	const groq: ProviderInitConfig | null = process.env.GROQ_API_KEY
		? {
				provider: "groq",
				apiKey: process.env.GROQ_API_KEY,
				baseURL: "https://api.groq.com/openai/v1",
				model: model ?? DEFAULT_MODELS.groq,
			}
		: null;
	const openai: ProviderInitConfig | null = process.env.OPENAI_API_KEY
		? {
				provider: "openai",
				apiKey: process.env.OPENAI_API_KEY,
				baseURL: process.env.OPENAI_BASE_URL || undefined,
				model: model ?? DEFAULT_MODELS.openai,
			}
		: null;
	if (provider === "groq") return groq ?? openai;
	return openai ?? groq;
}

export async function loadAiConfig(
	supabase: SupabaseClient,
	userId: string
): Promise<ProviderInitConfig | null> {
	const { data } = await supabase
		.from("user_settings")
		.select("ai_provider, ai_api_key_encrypted, ai_base_url, ai_default_model")
		.eq("user_id", userId)
		.maybeSingle();
	const settings = (data ?? null) as SettingsRow | null;
	const provider = settings?.ai_provider || "groq";
	const model = settings?.ai_default_model || undefined;
	if (settings?.ai_api_key_encrypted) {
		return {
			provider,
			apiKey: decryptApiKey(settings.ai_api_key_encrypted),
			baseURL: settings.ai_base_url || undefined,
			model: model ?? DEFAULT_MODELS[provider],
		};
	}
	return platformConfig(provider, model);
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new ProviderError(ProviderErrorType.CONNECTION_FAILED, "AI provider timed out.")),
					ms
				);
			}),
		]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

export type FeedbackResult = { feedback: PrepFeedback; model: string; provider: string };

/** Calls the provider once; throws when the output is not the strict feedback shape. */
export async function generateFeedback(
	config: ProviderInitConfig,
	question: PrepQuestion,
	answer: string
): Promise<FeedbackResult> {
	const provider = await createProvider(config);
	const model = config.model ?? DEFAULT_MODELS[config.provider] ?? "gpt-4o-mini";
	const completion = await withTimeout(
		provider.generateCompletion({
			model,
			systemPrompt: FEEDBACK_SYSTEM_PROMPT,
			userPrompt: buildFeedbackPrompt(question, answer),
			temperature: 0.3,
			maxTokens: 600,
			responseFormat: "json",
		}),
		FEEDBACK_TIMEOUT_MS
	);
	const feedback = parseFeedback(completion.content);
	if (!feedback) {
		throw new ProviderError(ProviderErrorType.INVALID_RESPONSE, "The AI reply was not valid feedback.");
	}
	return { feedback, model: completion.model || model, provider: config.provider };
}
