import { Sparkles } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AI_LABEL_HINT, AI_LABEL_TEXT } from "@/lib/ai/generations/labels";

type AiLabelProps = Readonly<{
	/** Short visible text, e.g. "AI draft" or "Drafted by your AI assistant". */
	label?: string;
	/** Longer explanation for the tooltip and screen readers. */
	hint?: string;
	className?: string;
}>;

/**
 * Marks AI-generated content (PRD area 11: label every AI-generated item).
 * Renders inline (a span), so it can sit next to or inside a heading.
 */
export function AiLabel({ label = AI_LABEL_TEXT, hint = AI_LABEL_HINT, className }: AiLabelProps) {
	return (
		<span
			className={cn(badgeVariants({ variant: "info" }), "shrink-0 whitespace-nowrap font-sans", className)}
			title={hint}
		>
			<Sparkles className="h-3 w-3" aria-hidden="true" />
			{label}
			<span className="sr-only">. {hint}</span>
		</span>
	);
}
