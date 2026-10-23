/** Request schema and update builder for /api/onboarding. No server imports. */

import { z } from "zod";
import { CAREER_STAGES, ONBOARDING_LIMITS as L, normalizeList, type CareerStage } from "./stages";

const shortText = (max: number) => z.string().trim().min(1).max(max);

export const onboardingSchema = z
	.object({
		career_stage: z.enum(CAREER_STAGES).nullable().optional(),
		goals: z.array(shortText(L.goalLength)).max(L.goals).optional(),
		target_role: z.string().trim().max(L.targetRoleLength).nullable().optional(),
		target_locations: z.array(shortText(L.locationLength)).max(L.locations).optional(),
		weekly_focus_hours: z.number().int().min(0).max(L.maxFocusHours).nullable().optional(),
		/** true when the person finishes or skips the whole setup */
		complete: z.boolean().optional(),
	})
	.strict();

export type OnboardingInput = z.infer<typeof onboardingSchema>;

export type OnboardingProfile = {
	career_stage: CareerStage | null;
	goals: string[];
	target_role: string | null;
	target_locations: string[];
	weekly_focus_hours: number | null;
	onboarded_at: string | null;
};

export const ONBOARDING_COLUMNS =
	"career_stage, goals, target_role, target_locations, weekly_focus_hours, onboarded_at";

/** Columns to write for a validated request. Only fields that were sent are touched. */
export function buildOnboardingUpdate(input: OnboardingInput, now: Date): Record<string, unknown> {
	const update: Record<string, unknown> = {};
	if (input.career_stage !== undefined) update.career_stage = input.career_stage;
	if (input.goals) update.goals = normalizeList(input.goals, L.goals, L.goalLength);
	if (input.target_role !== undefined) update.target_role = input.target_role || null;
	if (input.target_locations) {
		update.target_locations = normalizeList(input.target_locations, L.locations, L.locationLength);
	}
	if (input.weekly_focus_hours !== undefined) update.weekly_focus_hours = input.weekly_focus_hours;
	if (input.complete) update.onboarded_at = now.toISOString();
	return update;
}

/** Narrow a raw profiles row into the onboarding shape. */
export function toOnboardingProfile(row: Record<string, unknown> | null | undefined): OnboardingProfile {
	const stage = row?.career_stage;
	const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);
	return {
		career_stage: (CAREER_STAGES as readonly unknown[]).includes(stage) ? (stage as CareerStage) : null,
		goals: strings(row?.goals),
		target_role: typeof row?.target_role === "string" ? row.target_role : null,
		target_locations: strings(row?.target_locations),
		weekly_focus_hours: typeof row?.weekly_focus_hours === "number" ? row.weekly_focus_hours : null,
		onboarded_at: typeof row?.onboarded_at === "string" ? row.onboarded_at : null,
	};
}
