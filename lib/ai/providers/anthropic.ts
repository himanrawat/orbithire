/**
 * Anthropic (Claude) Provider Adapter
 * Implements the AIProvider interface for Anthropic models
 * Uses dynamic import to reduce bundle size
 */

import type {
	AIProvider,
	CompletionParams,
	CompletionResponse,
	ProviderInitConfig,
	TestConnectionResult,
	ValidationResult,
} from "./baseProvider";
import { ProviderError, ProviderErrorType } from "./baseProvider";
import { getProviderModels, type ModelInfo } from "./registry";

// Type-only import for Anthropic SDK
type AnthropicSDK = typeof import("@anthropic-ai/sdk").default;
type Anthropic = InstanceType<AnthropicSDK>;

export class AnthropicProvider implements AIProvider {
	private client: Anthropic | null = null;
	private config: ProviderInitConfig;
	private initPromise: Promise<void> | null = null;

	constructor(config: ProviderInitConfig) {
		this.config = config;
	}

	/**
	 * Lazy load the Anthropic SDK (dynamic import)
	 */
	private async initializeClient(): Promise<void> {
		if (this.client) return;

		if (!this.initPromise) {
			this.initPromise = (async () => {
				try {
					const AnthropicSDK = await import("@anthropic-ai/sdk");
					this.client = new AnthropicSDK.default({
						apiKey: this.config.apiKey,
					});
				} catch (error) {
					throw new ProviderError(
						ProviderErrorType.UNKNOWN,
						"Failed to load Anthropic SDK. Please ensure @anthropic-ai/sdk is installed.",
						error instanceof Error ? error.message : "Unknown error",
						"Run: npm install @anthropic-ai/sdk"
					);
				}
			})();
		}

		await this.initPromise;
	}

	getProviderName(): string {
		return "Anthropic (Claude)";
	}

	async generateCompletion(
		params: CompletionParams
	): Promise<CompletionResponse> {
		await this.initializeClient();
		if (!this.client) throw new Error("Client not initialized");

		try {
			// Anthropic has a different message format
			// System prompt is a separate parameter, not part of messages
			const message = await this.client.messages.create({
				model: params.model,
				system: params.systemPrompt,
				messages: [
					{
						role: "user",
						content: params.userPrompt,
					},
				],
				temperature: params.temperature ?? 0.7,
				max_tokens: params.maxTokens ?? 4000,
			});

			// Anthropic doesn't have native JSON mode
			// But Claude follows JSON instructions very well
			const content =
				message.content[0]?.type === "text" ? message.content[0].text : "";

			return {
				content,
				model: message.model,
				usage: {
					promptTokens: message.usage.input_tokens,
					completionTokens: message.usage.output_tokens,
					totalTokens: message.usage.input_tokens + message.usage.output_tokens,
				},
			};
		} catch (error: any) {
			throw this.handleError(error);
		}
	}

	async testConnection(): Promise<TestConnectionResult> {
		try {
			await this.initializeClient();
			if (!this.client) throw new Error("Client not initialized");

			// Make a minimal API call to test connection
			// Anthropic doesn't have a models.list endpoint, so we use a minimal message
			await this.client.messages.create({
				model: "claude-3-haiku-20240307", // Cheapest model for testing
				max_tokens: 10,
				messages: [
					{
						role: "user",
						content: "test",
					},
				],
			});

			const models = await this.listModels();

			return {
				success: true,
				models,
			};
		} catch (error: any) {
			return {
				success: false,
				error: this.handleError(error).message,
			};
		}
	}

	async listModels(): Promise<ModelInfo[]> {
		// Return models from registry
		return getProviderModels("anthropic");
	}

	async validateConfig(): Promise<ValidationResult> {
		if (!this.config.apiKey) {
			return {
				valid: false,
				error: "API key is required",
			};
		}

		if (this.config.apiKey.length < 20) {
			return {
				valid: false,
				error: "API key appears to be invalid (too short)",
			};
		}

		return { valid: true };
	}

	private handleError(error: any): ProviderError {
		const message = error?.message || "Unknown error";
		const status = error?.status;

		// Invalid API key
		if (status === 401 || message.includes("authentication")) {
			return new ProviderError(
				ProviderErrorType.INVALID_API_KEY,
				"Your Anthropic API key is invalid or expired.",
				message,
				"Get a new API key at https://console.anthropic.com/"
			);
		}

		// Rate limit
		if (status === 429 || message.includes("rate limit")) {
			return new ProviderError(
				ProviderErrorType.RATE_LIMIT,
				"Rate limit exceeded. Please try again later.",
				message,
				"Wait a few moments or upgrade your Anthropic plan"
			);
		}

		// Model not found
		if (status === 404 || message.includes("model_not_found")) {
			return new ProviderError(
				ProviderErrorType.MODEL_NOT_FOUND,
				"The specified model is not available.",
				message,
				"Check available models at https://docs.anthropic.com/claude/docs/models-overview"
			);
		}

		// Connection failed
		if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
			return new ProviderError(
				ProviderErrorType.CONNECTION_FAILED,
				"Failed to connect to Anthropic API.",
				message,
				"Check your internet connection and try again"
			);
		}

		// Unknown error
		return new ProviderError(
			ProviderErrorType.UNKNOWN,
			`Anthropic API error: ${message}`,
			message
		);
	}
}
