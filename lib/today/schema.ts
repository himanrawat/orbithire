/** Zod schemas for the Today API boundary and for stored daily_plans.items. */
import { z } from "zod";
import { PLAN_ITEM_KINDS, type PlanItem } from "./nextStep";

/** Plan links stay inside the app: a same-origin path, never "//host" or "javascript:". */
export function isInternalHref(href: string): boolean {
	return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
}

export const planItemSchema = z
	.object({
		id: z.string().min(1).max(120),
		kind: z.enum(PLAN_ITEM_KINDS),
		title: z.string().min(1).max(200),
		reason: z.string().max(400),
		href: z.string().max(300).refine(isInternalHref, "href must be an in-app path"),
		done: z.boolean(),
	})
	.strict();

const storedItemsSchema = z.array(planItemSchema.passthrough()).max(10);

/** Parses daily_plans.items, dropping the whole value if it is malformed. */
export function parseStoredItems(value: unknown): PlanItem[] {
	const parsed = storedItemsSchema.safeParse(value);
	if (!parsed.success) return [];
	return parsed.data.map(({ id, kind, title, reason, href, done }) => ({
		id,
		kind,
		title,
		reason,
		href,
		done,
	}));
}

export const planPatchSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("toggle"),
			itemId: z.string().min(1).max(120),
			done: z.boolean(),
		})
		.strict(),
	z.object({ action: z.literal("dismiss_next_step") }).strict(),
]);
export type PlanPatch = z.infer<typeof planPatchSchema>;

export const learningEntrySchema = z
	.object({ note: z.string().trim().min(1).max(500) })
	.strict();
