/**
 * Learning-path plan gate (PRD area 10), as pure rules. Free includes a set number of
 * paths (PLAN_LIMITS.free.learning_paths, 1): the first ones the user starts, in the order
 * they first opened a lesson. Lessons of an unlocked path stay fully usable; other paths
 * show a Pro prompt. Pro, own key or not, and billing-off get every path.
 */
import { limitFor, type Limit, type PlanContext } from "@/lib/billing/limits";

export type ProgressStart = Readonly<{ pathId: string; startedAt: string }>;

/** Path ids in the order the user first started them (earliest lesson start per path). */
export function startedPathOrder(rows: readonly ProgressStart[]): string[] {
	const first = new Map<string, number>();
	for (const row of rows) {
		const time = Date.parse(row.startedAt);
		const value = Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
		const current = first.get(row.pathId);
		if (current === undefined || value < current) first.set(row.pathId, value);
	}
	return [...first.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
}

export type PathAccess = Readonly<{
	/** null = every path is open. */
	limit: Limit;
	/** Paths the user may open: the first `limit` started ones. */
	unlocked: readonly string[];
	/** True while the user can still start a new path. */
	canStartNew: boolean;
}>;

export function buildPathAccess(
	ctx: Pick<PlanContext, "plan" | "hasOwnAiKey" | "billingEnabled">,
	startedOrder: readonly string[]
): PathAccess {
	const limit = limitFor(ctx, "learning_paths");
	if (limit === null) return { limit, unlocked: startedOrder, canStartNew: true };
	return { limit, unlocked: startedOrder.slice(0, limit), canStartNew: startedOrder.length < limit };
}

export function isPathUnlocked(access: PathAccess, pathId: string): boolean {
	if (access.limit === null || access.canStartNew) return true;
	return access.unlocked.includes(pathId);
}
