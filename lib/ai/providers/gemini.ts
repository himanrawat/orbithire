/**
 * Google Gemini Provider Adapter
 * Implements the AIProvider interface for Google Gemini models
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

// Type-only imports for Gemini SDK
type GoogleGenerativeAI = import("@google/generative-ai").GoogleGenerativeAI;
type GenerativeModel = import("@google/generative-ai").GenerativeModel;

export class GeminiProvider implements AIProvider {
	private client: GoogleGenerativeAI | null = null;
	private config: ProviderInitConfig;
	private initPromise: Promise<void> | null = null;

	constructor(config: ProviderInitConfig) {
		this.config = config;
	}

	/**
	 * Lazy load the Gemini SDK (dynamic import)
	 */
	private async initializeClient(): Promise<void> {
		if (this.client) return;

		if (!this.initPromise) {
			this.initPromise = (async () => {
				try {
					const { GoogleGenerativeAI } = await import("@google/generative-ai");
					this.client = new GoogleGenerativeAI(this.config.apiKey);
				} catch (error) {
					throw new ProviderError(
						ProviderErrorType.UNKNOWN,
						"Failed to load Google Generative AI SDK. Please ensure @google/generative-ai is installed.",
						error instanceof Error ? error.message : "Unknown error",
						"Run: npm install @google/generative-ai"
					);
				}
			})();
		}

		await this.initPromise;
	}

	getProviderName(): string {
		return "Google Gemini";
	}

	async generateCompletion(
		params: CompletionParams
	): Promise<CompletionResponse> {
		await this.initializeClient();
		if (!this.client) throw new Error("Client not initialized");

		try {
			const model = this.client.getGenerativeModel({
				model: params.model,
				generationConfig: {
					temperature: params.temperature ?? 0.7,
					maxOutputTokens: params.maxTokens ?? 4000,
					// Gemini supports JSON mode via responseMimeType
					...(params.responseFormat === "json" && {
						responseMimeType: "application/json",
					}),
				},
			});

			// Gemini combines system and user prompts
			const prompt = `${params.systemPrompt}\n\n${params.userPrompt}`;

			const result = await model.generateContent(prompt);
			const response = result.response;
			const content = response.text();

			// Gemini doesn't always return usage data in the same format
			const usage = response.usageMetadata || {};

			return {
				content,
				model: params.model,
				usage: {
					promptTokens: usage.promptTokenCount || 0,
					completionTokens: usage.candidatesTokenCount || 0,
					totalTokens: usage.totalTokenCount || 0,
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
			const model = this.client.getGenerativeModel({
				model: "gemini-pro",
			});

			await model.generateContent("test");

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
		return getProviderModels("gemini");
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

		// Invalid API key
		if (message.includes("API_KEY_INVALID") || message.includes("401")) {
			return new ProviderError(
				ProviderErrorType.INVALID_API_KEY,
				"Your Google AI API key is invalid or expired.",
				message,
				"Get a new API key at https://ai.google.dev/"
			);
		}

		// Rate limit / quota exceeded
		if (
			message.includes("RATE_LIMIT_EXCEEDED") ||
			message.includes("QUOTA_EXCEEDED") ||
			message.includes("429")
		) {
			return new ProviderError(
				ProviderErrorType.RATE_LIMIT,
				"Rate limit or quota exceeded. Please try again later.",
				message,
				"Wait a few moments or check your quota at https://ai.google.dev/"
			);
		}

		// Model not found
		if (message.includes("NOT_FOUND") || message.includes("404")) {
			return new ProviderError(
				ProviderErrorType.MODEL_NOT_FOUND,
				"The specified model is not available.",
				message,
				"Check available models at https://ai.google.dev/models"
			);
		}

		// Connection failed
		if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
			return new ProviderError(
				ProviderErrorType.CONNECTION_FAILED,
				"Failed to connect to Google AI API.",
				message,
				"Check your internet connection and try again"
			);
		}

		// Unknown error
		return new ProviderError(
			ProviderErrorType.UNKNOWN,
			`Google AI API error: ${message}`,
			message
		);
	}
}
