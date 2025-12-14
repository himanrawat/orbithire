/**
 * Groq Provider Adapter
 * Implements the AIProvider interface for Groq models (OpenAI-compatible API)
 */

import OpenAI from "openai";
import type {
	AIProvider,
	CompletionParams,
	CompletionResponse,
	ProviderInitConfig,
	TestConnectionResult,
	ValidationResult,
} from "./baseProvider";
import { ProviderError, ProviderErrorType } from "./baseProvider";
import { getProviderModels, isModelDeprecated, getReplacementModel, type ModelInfo } from "./registry";

export class GroqProvider implements AIProvider {
	private client: OpenAI;
	private config: ProviderInitConfig;

	constructor(config: ProviderInitConfig) {
		this.config = config;
		this.client = new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseURL || "https://api.groq.com/openai/v1",
		});
	}

	getProviderName(): string {
		return "Groq";
	}

	async generateCompletion(
		params: CompletionParams
	): Promise<CompletionResponse> {
		try {
			const completionParams: OpenAI.ChatCompletionCreateParams = {
				model: params.model,
				messages: [
					{ role: "system", content: params.systemPrompt },
					{ role: "user", content: params.userPrompt },
				],
				temperature: params.temperature ?? 0.7,
				max_tokens: params.maxTokens ?? 4000,
			};

			// Groq does NOT support response_format for JSON mode
			// Instead, we rely on prompt instructions to return JSON
			// The prompt should explicitly ask for JSON output

			const completion = await this.client.chat.completions.create(
				completionParams
			);

			const content = completion.choices[0]?.message?.content || "";

			return {
				content,
				model: completion.model,
				usage: {
					promptTokens: completion.usage?.prompt_tokens || 0,
					completionTokens: completion.usage?.completion_tokens || 0,
					totalTokens: completion.usage?.total_tokens || 0,
				},
			};
		} catch (error: any) {
			throw this.handleError(error);
		}
	}

	async testConnection(): Promise<TestConnectionResult> {
		try {
			// Make a minimal API call to test connection
			await this.client.models.list();
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
		return getProviderModels("groq");
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

		// Check for deprecated model
		if (this.config.model && isModelDeprecated("groq", this.config.model)) {
			const replacement = getReplacementModel("groq", this.config.model);
			return {
				valid: false,
				error: `Model ${this.config.model} has been deprecated`,
				details: replacement
					? `Please use ${replacement.id} instead`
					: "Please select a different model",
			};
		}

		return { valid: true };
	}

	private handleError(error: any): ProviderError {
		const message = error?.message || "Unknown error";
		const errorBody = error?.error || {};

		// Model decommissioned (specific to Groq)
		if (errorBody.code === "model_decommissioned") {
			return new ProviderError(
				ProviderErrorType.MODEL_DEPRECATED,
				"This model has been decommissioned by Groq.",
				errorBody.message,
				"Check https://console.groq.com/docs/deprecations for recommended replacements"
			);
		}

		// Invalid API key
		if (message.includes("Invalid API Key") || error?.status === 401) {
			return new ProviderError(
				ProviderErrorType.INVALID_API_KEY,
				"Your Groq API key is invalid or expired.",
				message,
				"Get a new API key at https://console.groq.com/keys"
			);
		}

		// Rate limit
		if (message.includes("rate limit") || error?.status === 429) {
			return new ProviderError(
				ProviderErrorType.RATE_LIMIT,
				"Rate limit exceeded. Please try again later.",
				message,
				"Wait a few moments or upgrade your Groq plan"
			);
		}

		// Model not found
		if (message.includes("model") && error?.status === 404) {
			return new ProviderError(
				ProviderErrorType.MODEL_NOT_FOUND,
				"The specified model is not available on Groq.",
				message,
				"Check available models at https://console.groq.com/docs/models"
			);
		}

		// Connection failed
		if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
			return new ProviderError(
				ProviderErrorType.CONNECTION_FAILED,
				"Failed to connect to Groq API.",
				message,
				"Check your internet connection and try again"
			);
		}

		// Unknown error
		return new ProviderError(
			ProviderErrorType.UNKNOWN,
			`Groq API error: ${message}`,
			message
		);
	}
}
