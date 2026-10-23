/**
 * "For you" ranking (PRD v2, area 6): helpful-per-view with time decay. Pure, so it's
 * unit-tested and shared by the server loader.
 *
 *   score = (helpful + PRIOR_HELPFUL) / (views + PRIOR_VIEWS) / (1 + ageHours / HALF_LIFE_HOURS) ^ GRAVITY
 *
 * The priors keep a post with 1 helpful out of 1 view from outranking one with 40 out of
 * 100, and give new posts a fair start before they have views. Replies add a small bonus
 * so questions with answers surface.
 */

export const RANKING = {
	priorHelpful: 1,
	priorViews: 10,
	replyWeight: 0.25,
	halfLifeHours: 24,
	gravity: 1.5,
} as const;

export type RankInput = Readonly<{
	helpfulCount: number;
	viewCount: number;
	replyCount: number;
	createdAt: string;
}>;

function nonNegative(value: number) {
	return Number.isFinite(value) && value > 0 ? value : 0;
}

export function ageInHours(createdAt: string, now: Date) {
	const created = new Date(createdAt).getTime();
	if (Number.isNaN(created)) return Number.POSITIVE_INFINITY;
	return Math.max(0, (now.getTime() - created) / 3_600_000);
}

export function rankScore(input: RankInput, now: Date) {
	const helpful = nonNegative(input.helpfulCount) + RANKING.replyWeight * nonNegative(input.replyCount);
	const views = Math.max(nonNegative(input.viewCount), nonNegative(input.helpfulCount));
	const ratio = (helpful + RANKING.priorHelpful) / (views + RANKING.priorViews);
	const age = ageInHours(input.createdAt, now);
	if (!Number.isFinite(age)) return 0;
	const decay = Math.pow(1 + age / RANKING.halfLifeHours, RANKING.gravity);
	return ratio / decay;
}

/** Highest score first; ties go to the newer post. Returns a new array. */
export function rankPosts<T extends RankInput>(posts: readonly T[], now: Date, limit?: number): T[] {
	const scored = posts.map((post) => ({ post, score: rankScore(post, now) }));
	scored.sort((a, b) => b.score - a.score || b.post.createdAt.localeCompare(a.post.createdAt));
	const ranked = scored.map((entry) => entry.post);
	return limit === undefined ? ranked : ranked.slice(0, limit);
}
