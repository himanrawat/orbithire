/**
 * Provider Factory
 * Creates the appropriate provider instance based on configuration
 * Uses dynamic imports for Anthropic and Gemini to keep bundle size small
 */

import type { AIProvider, ProviderInitConfig } from "./providers/baseProvider";
import { ProviderError, ProviderErrorType } from "./providers/baseProvider";
import { getProvider } from "./providers/registry";

/**
 * Create a provider instance based on configuration
 * OpenAI and Groq are loaded immediately (they use the same SDK)
 * Anthropic and Gemini are loaded dynamically when needed
 */
export async function createProvider(
	config: ProviderInitConfig
): Promise<AIProvider> {
	const { provider } = config;

	// Validate that provider exists in registry
	const providerConfig = getProvider(provider);
	if (!providerConfig) {
		throw new ProviderError(
			ProviderErrorType.UNKNOWN,
			`Unknown provider: ${provider}`,
			`Valid providers are: openai, groq, anthropic, gemini`
		);
	}

	// Create provider instance based on type
	switch (provider) {
		case "openai": {
			const { OpenAIProvider } = await import("./providers/openai");
			return new OpenAIProvider(config);
		}

		case "groq": {
			const { GroqProvider } = await import("./providers/groq");
			return new GroqProvider(config);
		}

		case "anthropic": {
			// Dynamic import to reduce bundle size
			const { AnthropicProvider } = await import("./providers/anthropic");
			return new AnthropicProvider(config);
		}

		case "gemini": {
			// Dynamic import to reduce bundle size
			const { GeminiProvider } = await import("./providers/gemini");
			return new GeminiProvider(config);
		}

		default:
			throw new ProviderError(
				ProviderErrorType.UNKNOWN,
				`Unsupported provider: ${provider}`,
				`Provider ${provider} is not implemented yet`
			);
	}
}

/**
 * Test a provider configuration without creating a full provider instance
 */
export async function testProviderConfig(
	config: ProviderInitConfig
): Promise<{ success: boolean; error?: string }> {
	try {
		const provider = await createProvider(config);
		const validation = await provider.validateConfig();

		if (!validation.valid) {
			return {
				success: false,
				error: validation.error || "Configuration validation failed",
			};
		}

		const testResult = await provider.testConnection();

		return {
			success: testResult.success,
			error: testResult.error,
		};
	} catch (error) {
		if (error instanceof ProviderError) {
			return {
				success: false,
				error: error.message,
			};
		}

		return {
			success: false,
			error:
				error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}
