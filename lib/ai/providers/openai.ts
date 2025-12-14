/**
 * OpenAI Provider Adapter
 * Implements the AIProvider interface for OpenAI models
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
import { getProviderModels, type ModelInfo } from "./registry";

export class OpenAIProvider implements AIProvider {
	private client: OpenAI;
	private config: ProviderInitConfig;

	constructor(config: ProviderInitConfig) {
		this.config = config;
		this.client = new OpenAI({
			apiKey: config.apiKey,
			baseURL: config.baseURL || "https://api.openai.com/v1",
		});
	}

	getProviderName(): string {
		return "OpenAI";
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

			// OpenAI supports native JSON mode
			if (params.responseFormat === "json") {
				completionParams.response_format = { type: "json_object" };
			}

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
			const response = await this.client.models.list();
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
		// Return models from registry (not from API, as we want our categorized data)
		return getProviderModels("openai");
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
		if (message.includes("Incorrect API key") || error?.status === 401) {
			return new ProviderError(
				ProviderErrorType.INVALID_API_KEY,
				"Your OpenAI API key is invalid or expired.",
				message,
				"Get a new API key at https://platform.openai.com/api-keys"
			);
		}

		// Rate limit
		if (message.includes("Rate limit") || error?.status === 429) {
			return new ProviderError(
				ProviderErrorType.RATE_LIMIT,
				"Rate limit exceeded. Please try again later.",
				message,
				"Wait a few moments or upgrade your OpenAI plan"
			);
		}

		// Model not found
		if (message.includes("model") && error?.status === 404) {
			return new ProviderError(
				ProviderErrorType.MODEL_NOT_FOUND,
				"The specified model is not available.",
				message,
				"Check your selected model and try a different one"
			);
		}

		// Connection failed
		if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
			return new ProviderError(
				ProviderErrorType.CONNECTION_FAILED,
				"Failed to connect to OpenAI API.",
				message,
				"Check your internet connection and try again"
			);
		}

		// Unknown error
		return new ProviderError(
			ProviderErrorType.UNKNOWN,
			`OpenAI API error: ${message}`,
			message
		);
	}
}
