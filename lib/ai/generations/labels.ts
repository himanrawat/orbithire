/** Copy for the AI label shown on generated content (components/AiLabel.tsx). */

export const AI_LABEL_TEXT = "AI draft";
export const AI_LABEL_HINT =
	"Drafted by AI from your profile and the job post. Check every fact before you send it.";
export const AI_ASSISTANT_LABEL_TEXT = "Drafted by your AI assistant";

/**
 * Label for a saved document by its source column, or null when it was not
 * AI-generated. portal = our generator, mcp = the user's own AI assistant over MCP,
 * import = a file the user uploaded.
 */
export function aiLabelForSource(source: string | null | undefined): string | null {
	if (source === "portal") return AI_LABEL_TEXT;
	if (source === "mcp") return AI_ASSISTANT_LABEL_TEXT;
	return null;
}
