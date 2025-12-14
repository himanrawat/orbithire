/**
 * AI Provider Registry
 * Central configuration for all AI providers, models, and capabilities
 */

export type ModelCategory =
	| "recommended"
	| "alternative"
	| "experimental"
	| "deprecated"
	| "specialized";

export type ModelStatus = "active" | "beta" | "deprecated";

export type SDKType = "openai-compatible" | "anthropic" | "google" | "custom";

export interface ModelInfo {
	id: string;
	name: string;
	category: ModelCategory;
	status: ModelStatus;
	replacedBy?: string;
	capabilities: {
		supportsJSON: boolean;
		supportsStreaming: boolean;
		supportsFunctionCalling: boolean;
		supportsVision?: boolean;
	};
	performance: {
		speed: number; // 1-10, 10 is fastest
		quality: number; // 1-10, 10 is highest quality
		cost: number; // 1-10, 1 is cheapest
	};
	contextWindow: number;
	bestFor: string[];
	description: string;
}

export interface ProviderConfig {
	id: string;
	name: string;
	displayName: string;
	baseURL: string;
	sdkType: SDKType;
	requiresApiKey: boolean;
	features: string[];
	pros: string[];
	cons: string[];
	signupUrl: string;
	models: ModelInfo[];
}

// =============================================================================
// OPENAI PROVIDER
// =============================================================================

const openaiModels: ModelInfo[] = [
	{
		id: "gpt-4o-mini",
		name: "GPT-4o Mini",
		category: "recommended",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 9,
			quality: 8,
			cost: 2,
		},
		contextWindow: 128000,
		bestFor: ["Resume generation", "Cover letters", "Quick tasks"],
		description:
			"Fast, affordable, and high-quality. Best all-around choice for most tasks.",
	},
	{
		id: "gpt-4o",
		name: "GPT-4o",
		category: "recommended",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 8,
			quality: 9,
			cost: 5,
		},
		contextWindow: 128000,
		bestFor: ["Complex resumes", "Premium quality", "Detailed analysis"],
		description: "Highest quality model with vision support. Best for premium results.",
	},
	{
		id: "gpt-4-turbo",
		name: "GPT-4 Turbo",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 7,
			quality: 9,
			cost: 6,
		},
		contextWindow: 128000,
		bestFor: ["Long documents", "Complex analysis"],
		description: "Previous generation flagship model. Still excellent quality.",
	},
	{
		id: "gpt-3.5-turbo",
		name: "GPT-3.5 Turbo",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: false,
		},
		performance: {
			speed: 10,
			quality: 6,
			cost: 1,
		},
		contextWindow: 16385,
		bestFor: ["Budget-conscious", "Simple tasks", "Quick generation"],
		description: "Fastest and cheapest option. Good for simple resumes.",
	},
];

export const openaiProvider: ProviderConfig = {
	id: "openai",
	name: "openai",
	displayName: "OpenAI",
	baseURL: "https://api.openai.com/v1",
	sdkType: "openai-compatible",
	requiresApiKey: true,
	features: [
		"JSON mode",
		"Function calling",
		"Streaming",
		"Vision (selected models)",
	],
	pros: [
		"Industry standard with excellent documentation",
		"Consistent quality across models",
		"Wide range of model options",
		"Vision support in latest models",
	],
	cons: [
		"More expensive than Groq for similar tasks",
		"Requires paid account for API access",
	],
	signupUrl: "https://platform.openai.com/signup",
	models: openaiModels,
};

// =============================================================================
// GROQ PROVIDER
// =============================================================================

const groqModels: ModelInfo[] = [
	{
		id: "llama-3.3-70b-versatile",
		name: "Llama 3.3 70B Versatile",
		category: "recommended",
		status: "active",
		capabilities: {
			supportsJSON: false, // Requires prompt instructions
			supportsStreaming: true,
			supportsFunctionCalling: false,
			supportsVision: false,
		},
		performance: {
			speed: 10,
			quality: 8,
			cost: 1,
		},
		contextWindow: 8192,
		bestFor: [
			"Fast resume generation",
			"Budget-friendly",
			"High throughput",
		],
		description:
			"Ultra-fast inference with excellent quality. Best for speed-critical tasks.",
	},
	{
		id: "llama-3.1-8b-instant",
		name: "Llama 3.1 8B Instant",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: false,
			supportsVision: false,
		},
		performance: {
			speed: 10,
			quality: 6,
			cost: 1,
		},
		contextWindow: 8192,
		bestFor: ["Keyword extraction", "Quick tasks", "Simple resumes"],
		description:
			"Blazing fast, perfect for simple tasks and keyword extraction.",
	},
	{
		id: "mixtral-8x7b-32768",
		name: "Mixtral 8x7B",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: false,
			supportsVision: false,
		},
		performance: {
			speed: 9,
			quality: 7,
			cost: 1,
		},
		contextWindow: 32768,
		bestFor: ["Large documents", "Long context", "Complex resumes"],
		description: "Large context window for handling longer documents.",
	},
	{
		id: "gemma2-9b-it",
		name: "Gemma 2 9B IT",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: false,
			supportsVision: false,
		},
		performance: {
			speed: 9,
			quality: 6,
			cost: 1,
		},
		contextWindow: 8192,
		bestFor: ["Instruction following", "Technical content"],
		description: "Instruction-tuned model, good for technical resumes.",
	},
	{
		id: "llama-3.1-70b-versatile",
		name: "Llama 3.1 70B Versatile (DEPRECATED)",
		category: "deprecated",
		status: "deprecated",
		replacedBy: "llama-3.3-70b-versatile",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: false,
			supportsVision: false,
		},
		performance: {
			speed: 10,
			quality: 7,
			cost: 1,
		},
		contextWindow: 8192,
		bestFor: [],
		description:
			"DEPRECATED: This model has been decommissioned. Use llama-3.3-70b-versatile instead.",
	},
];

export const groqProvider: ProviderConfig = {
	id: "groq",
	name: "groq",
	displayName: "Groq",
	baseURL: "https://api.groq.com/openai/v1",
	sdkType: "openai-compatible",
	requiresApiKey: true,
	features: ["Ultra-fast inference", "Streaming", "Free tier available"],
	pros: [
		"10x faster than other providers",
		"Free tier available",
		"Great quality for open-source models",
		"Cost-effective for high volume",
	],
	cons: [
		"No native JSON mode (use prompt instructions)",
		"Smaller context windows than GPT-4",
		"Limited function calling support",
	],
	signupUrl: "https://console.groq.com/",
	models: groqModels,
};

// =============================================================================
// ANTHROPIC PROVIDER
// =============================================================================

const anthropicModels: ModelInfo[] = [
	{
		id: "claude-3-5-sonnet-20241022",
		name: "Claude 3.5 Sonnet",
		category: "recommended",
		status: "active",
		capabilities: {
			supportsJSON: false, // Follows JSON instructions very well
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 7,
			quality: 10,
			cost: 7,
		},
		contextWindow: 200000,
		bestFor: [
			"Highest quality writing",
			"Complex cover letters",
			"Nuanced content",
		],
		description:
			"Best-in-class quality for writing and analysis. Excellent for cover letters.",
	},
	{
		id: "claude-3-opus-20240229",
		name: "Claude 3 Opus",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 5,
			quality: 10,
			cost: 10,
		},
		contextWindow: 200000,
		bestFor: ["Premium quality", "Complex analysis", "Detailed work"],
		description:
			"Most capable Claude model. Premium pricing for premium results.",
	},
	{
		id: "claude-3-sonnet-20240229",
		name: "Claude 3 Sonnet",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 7,
			quality: 9,
			cost: 6,
		},
		contextWindow: 200000,
		bestFor: ["Balanced performance", "Large documents"],
		description:
			"Previous generation Sonnet. Balanced speed and quality.",
	},
	{
		id: "claude-3-haiku-20240307",
		name: "Claude 3 Haiku",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: false,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: false,
		},
		performance: {
			speed: 9,
			quality: 7,
			cost: 2,
		},
		contextWindow: 200000,
		bestFor: ["Fast tasks", "Budget-friendly", "Simple resumes"],
		description: "Fastest Claude model. Cost-effective for simple tasks.",
	},
];

export const anthropicProvider: ProviderConfig = {
	id: "anthropic",
	name: "anthropic",
	displayName: "Anthropic (Claude)",
	baseURL: "https://api.anthropic.com/v1",
	sdkType: "anthropic",
	requiresApiKey: true,
	features: [
		"Exceptional writing quality",
		"200k context window",
		"Vision support",
		"Function calling",
	],
	pros: [
		"Best-in-class writing quality",
		"Excellent at following complex instructions",
		"Massive 200k context window",
		"Strong safety features",
	],
	cons: [
		"More expensive than Groq/Gemini",
		"No native JSON mode (relies on instructions)",
		"Requires separate SDK",
	],
	signupUrl: "https://console.anthropic.com/",
	models: anthropicModels,
};

// =============================================================================
// GOOGLE GEMINI PROVIDER
// =============================================================================

const geminiModels: ModelInfo[] = [
	{
		id: "gemini-1.5-flash",
		name: "Gemini 1.5 Flash",
		category: "recommended",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 9,
			quality: 8,
			cost: 1,
		},
		contextWindow: 1000000,
		bestFor: [
			"Fast generation",
			"Large documents",
			"Budget-friendly",
		],
		description:
			"Extremely fast with massive context window. Great for long resumes.",
	},
	{
		id: "gemini-1.5-pro",
		name: "Gemini 1.5 Pro",
		category: "recommended",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: true,
		},
		performance: {
			speed: 7,
			quality: 9,
			cost: 4,
		},
		contextWindow: 2000000,
		bestFor: [
			"Complex analysis",
			"Very long documents",
			"High quality",
		],
		description:
			"2M token context window. Perfect for comprehensive resume analysis.",
	},
	{
		id: "gemini-pro",
		name: "Gemini Pro",
		category: "alternative",
		status: "active",
		capabilities: {
			supportsJSON: true,
			supportsStreaming: true,
			supportsFunctionCalling: true,
			supportsVision: false,
		},
		performance: {
			speed: 8,
			quality: 7,
			cost: 2,
		},
		contextWindow: 32000,
		bestFor: ["General tasks", "Standard resumes"],
		description: "Previous generation model. Solid performance at low cost.",
	},
];

export const geminiProvider: ProviderConfig = {
	id: "gemini",
	name: "gemini",
	displayName: "Google Gemini",
	baseURL: "https://generativelanguage.googleapis.com/v1beta",
	sdkType: "google",
	requiresApiKey: true,
	features: [
		"Massive context windows (up to 2M tokens)",
		"JSON mode support",
		"Vision capabilities",
		"Free tier available",
	],
	pros: [
		"Industry-leading context windows",
		"Free tier with generous limits",
		"Native JSON support",
		"Fast inference",
	],
	cons: [
		"Requires separate Google AI SDK",
		"Different API structure than OpenAI",
		"Less documentation than OpenAI",
	],
	signupUrl: "https://ai.google.dev/",
	models: geminiModels,
};

// =============================================================================
// REGISTRY
// =============================================================================

export const providerRegistry: Record<string, ProviderConfig> = {
	openai: openaiProvider,
	groq: groqProvider,
	anthropic: anthropicProvider,
	gemini: geminiProvider,
};

export const allProviders = Object.values(providerRegistry);

/**
 * Get provider configuration by ID
 */
export function getProvider(providerId: string): ProviderConfig | undefined {
	return providerRegistry[providerId];
}

/**
 * Get all models from a provider
 */
export function getProviderModels(providerId: string): ModelInfo[] {
	const provider = getProvider(providerId);
	return provider?.models || [];
}

/**
 * Get a specific model by provider and model ID
 */
export function getModel(
	providerId: string,
	modelId: string
): ModelInfo | undefined {
	const models = getProviderModels(providerId);
	return models.find((m) => m.id === modelId);
}

/**
 * Check if a model is deprecated
 */
export function isModelDeprecated(
	providerId: string,
	modelId: string
): boolean {
	const model = getModel(providerId, modelId);
	return model?.status === "deprecated";
}

/**
 * Get replacement for a deprecated model
 */
export function getReplacementModel(
	providerId: string,
	modelId: string
): ModelInfo | undefined {
	const model = getModel(providerId, modelId);
	if (!model?.replacedBy) return undefined;

	return getModel(providerId, model.replacedBy);
}
