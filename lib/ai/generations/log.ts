/**
 * AI generation log (PRD area 11: "label every AI-generated item; log the model and
 * prompt version"). One row per AI output in public.ai_generations.
 *
 * Logging never fails the request it belongs to: errors are reported and swallowed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPromptVersion, type PromptFeature } from "@/lib/prompts/versions";

export type AiGenerationItemType =
	| "resume"
	| "cover_letter"
	| "profile"
	| "document";

export type AiGenerationEntry = Readonly<{
	userId: string;
	feature: PromptFeature;
	model: string;
	provider?: string | null;
	itemType?: AiGenerationItemType | null;
	itemRef?: string | null;
}>;

export type AiGenerationRow = {
	user_id: string;
	feature: string;
	model: string;
	provider: string | null;
	prompt_version: string;
	item_type: string | null;
	item_ref: string | null;
};

const MAX_TEXT = 200;

function clip(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

export function buildAiGenerationRow(entry: AiGenerationEntry): AiGenerationRow {
	return {
		user_id: entry.userId,
		feature: entry.feature,
		model: clip(entry.model) ?? "unknown",
		provider: clip(entry.provider),
		prompt_version: getPromptVersion(entry.feature),
		item_type: entry.itemType ?? null,
		item_ref: clip(entry.itemRef),
	};
}

/**
 * Insert several generation rows in one request. Returns the new row ids in input
 * order, or an empty array when logging failed.
 */
export async function logAiGenerations(
	supabase: SupabaseClient,
	entries: readonly AiGenerationEntry[]
): Promise<string[]> {
	if (entries.length === 0) return [];
	try {
		const { data, error } = await supabase
			.from("ai_generations")
			.insert(entries.map(buildAiGenerationRow))
			.select("id");
		if (error) {
			console.error("[ai_generations] insert failed:", error.message);
			return [];
		}
		return (data ?? []).map((row: { id: string }) => row.id);
	} catch (error) {
		console.error("[ai_generations] insert failed:", error);
		return [];
	}
}

export async function logAiGeneration(
	supabase: SupabaseClient,
	entry: AiGenerationEntry
): Promise<string | null> {
	const [id] = await logAiGenerations(supabase, [entry]);
	return id ?? null;
}
