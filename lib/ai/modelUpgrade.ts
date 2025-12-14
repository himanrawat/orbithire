/**
 * Model Auto-Upgrade Utility
 * Handles automatic migration from deprecated models to their replacements
 */

import {
	getModel,
	getReplacementModel,
	isModelDeprecated,
} from "./providers/registry";

export interface UpgradeResult {
	wasDeprecated: boolean;
	originalModel: string;
	upgradedModel?: string;
	message?: string;
}

/**
 * Check if a model is deprecated and return its replacement
 */
export function autoUpgradeDeprecatedModel(
	provider: string,
	modelId: string
): UpgradeResult {
	// Check if model is deprecated
	if (!isModelDeprecated(provider, modelId)) {
		return {
			wasDeprecated: false,
			originalModel: modelId,
		};
	}

	// Get the replacement model
	const replacement = getReplacementModel(provider, modelId);
	const originalModel = getModel(provider, modelId);

	if (!replacement) {
		return {
			wasDeprecated: true,
			originalModel: modelId,
			message: `The model "${modelId}" has been deprecated, but no automatic replacement is available. Please select a different model from the ${provider} provider.`,
		};
	}

	return {
		wasDeprecated: true,
		originalModel: modelId,
		upgradedModel: replacement.id,
		message: `Your model "${originalModel?.name || modelId}" has been deprecated and automatically upgraded to "${replacement.name}" (${replacement.id}). This newer model offers better performance and quality.`,
	};
}

/**
 * Generate a user-friendly deprecation warning message
 */
export function getDeprecationWarning(
	provider: string,
	modelId: string
): string | null {
	const model = getModel(provider, modelId);

	if (!model || model.status !== "deprecated") {
		return null;
	}

	const replacement = getReplacementModel(provider, modelId);

	if (replacement) {
		return `⚠️ The model "${model.name}" (${model.id}) has been deprecated by ${provider}. We recommend upgrading to "${replacement.name}" (${replacement.id}) for continued support and improved performance.`;
	}

	return `⚠️ The model "${model.name}" (${model.id}) has been deprecated by ${provider}. Please select a different model.`;
}

/**
 * Check if user's current configuration needs upgrade
 * Returns upgrade details or null if no upgrade needed
 */
export function checkConfigurationUpgrade(
	provider: string,
	model: string
): {
	needsUpgrade: boolean;
	currentModel: string;
	recommendedModel?: string;
	reason?: string;
} {
	const upgradeResult = autoUpgradeDeprecatedModel(provider, model);

	if (!upgradeResult.wasDeprecated) {
		return {
			needsUpgrade: false,
			currentModel: model,
		};
	}

	return {
		needsUpgrade: true,
		currentModel: model,
		recommendedModel: upgradeResult.upgradedModel,
		reason: upgradeResult.message,
	};
}
