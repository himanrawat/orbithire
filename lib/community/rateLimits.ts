/**
 * Posting limits (PRD v2, area 6: "rate limits on new accounts"). Pure: the server
 * decides whether someone is new and feeds the result to `consume_rate_limit`.
 */

export const NEW_ACCOUNT_DAYS = 7;
const DAY_SECONDS = 24 * 60 * 60;

export type CommunityAction = "post" | "reply" | "report";

type Limit = Readonly<{ limit: number; windowSeconds: number }>;

const LIMITS: Readonly<Record<CommunityAction, Readonly<{ newAccount: Limit; established: Limit }>>> = {
	post: {
		newAccount: { limit: 3, windowSeconds: DAY_SECONDS },
		established: { limit: 20, windowSeconds: DAY_SECONDS },
	},
	reply: {
		newAccount: { limit: 20, windowSeconds: DAY_SECONDS },
		established: { limit: 200, windowSeconds: DAY_SECONDS },
	},
	report: {
		newAccount: { limit: 10, windowSeconds: DAY_SECONDS },
		established: { limit: 30, windowSeconds: DAY_SECONDS },
	},
};

function within(dateValue: string | null | undefined, days: number, now: Date) {
	if (!dateValue) return false;
	const time = new Date(dateValue).getTime();
	if (Number.isNaN(time)) return false;
	return now.getTime() - time < days * DAY_SECONDS * 1000;
}

/** New when either the account or the community membership is younger than 7 days. */
export function isNewAccount(
	accountCreatedAt: string | null | undefined,
	joinedAt: string | null | undefined,
	now: Date
) {
	return within(accountCreatedAt, NEW_ACCOUNT_DAYS, now) || within(joinedAt, NEW_ACCOUNT_DAYS, now);
}

export function communityLimit(action: CommunityAction, isNew: boolean) {
	const tier = isNew ? "newAccount" : "established";
	return { scope: `community.${action}.${tier === "newAccount" ? "new" : "member"}`, ...LIMITS[action][tier] };
}
