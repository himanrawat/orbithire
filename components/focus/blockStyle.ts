import type { BlockKind } from "@/lib/focus/schemas";

/** Each block type takes its product-area color. */
export const BLOCK_TONES: Readonly<Record<BlockKind, string>> = {
	learn: "var(--kind-learn)",
	prep: "var(--kind-prep)",
	apply: "var(--kind-jobs)",
	focus: "var(--kind-focus)",
	other: "var(--ink-muted)",
};
