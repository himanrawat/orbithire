/**
 * Base Provider Interface
 * Defines the contract that all AI provider adapters must implement
 */

import type { ModelInfo } from "./registry";

export interface CompletionParams {
	model: string;
	systemPrompt: string;
	userPrompt: string;
	temperature?: number;
	maxTokens?: number;
	responseFormat?: "text" | "json";
}

export interface CompletionResponse {
	content: string;
	model: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

export interface ValidationResult {
	valid: boolean;
	error?: string;
	details?: string;
}

export interface TestConnectionResult {
	success: boolean;
	error?: string;
	models?: ModelInfo[];
}

/**
 * Base interface that all AI providers must implement
 */
export interface AIProvider {
	/**
	 * Generate a text completion
	 */
	generateCompletion(params: CompletionParams): Promise<CompletionResponse>;

	/**
	 * Test the connection and validate the API key
	 */
	testConnection(): Promise<TestConnectionResult>;

	/**
	 * List available models for this provider
	 */
	listModels(): Promise<ModelInfo[]>;

	/**
	 * Validate provider configuration
	 */
	validateConfig(): Promise<ValidationResult>;

	/**
	 * Get provider name
	 */
	getProviderName(): string;
}

/**
 * Configuration for initializing a provider
 */
export interface ProviderInitConfig {
	provider: string;
	apiKey: string;
	baseURL?: string;
	model?: string;
}

/**
 * Error types for provider operations
 */
export enum ProviderErrorType {
	INVALID_API_KEY = "INVALID_API_KEY",
	MODEL_NOT_FOUND = "MODEL_NOT_FOUND",
	RATE_LIMIT = "RATE_LIMIT",
	MODEL_DEPRECATED = "MODEL_DEPRECATED",
	CONNECTION_FAILED = "CONNECTION_FAILED",
	INVALID_RESPONSE = "INVALID_RESPONSE",
	UNKNOWN = "UNKNOWN",
}

/**
 * Standard error class for provider operations
 */
export class ProviderError extends Error {
	constructor(
		public type: ProviderErrorType,
		message: string,
		public details?: string,
		public suggestion?: string
	) {
		super(message);
		this.name = "ProviderError";
	}
}
