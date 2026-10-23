/**
 * Prompt versions, logged with every AI generation (ai_generations.prompt_version).
 *
 * Bump the matching version whenever a system prompt, user-prompt builder or the
 * model parameters for that feature change, so a generated item can be traced back
 * to the exact instructions that produced it. Format: <feature>@<YYYY-MM-DD>.<n>
 */
export const PROMPT_VERSIONS = {
	resume: "resume@2026-10-23.1",
	cover_letter: "cover_letter@2026-10-23.1",
	profile_extraction: "profile_extraction@2026-10-23.1",
	profile_extraction_vision: "profile_extraction_vision@2026-10-23.1",
} as const;

export type PromptFeature = keyof typeof PROMPT_VERSIONS;

export function getPromptVersion(feature: PromptFeature): string {
	return PROMPT_VERSIONS[feature];
}
