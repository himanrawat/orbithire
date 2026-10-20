/**
 * Server-only: application (companies row) status change for the MCP
 * update_application_status tool. Follows the same rules as
 * PATCH /api/companies/[id] for a status-only change:
 *   - status_history gets {from, to, changed_at}
 *   - applied_at is set when moving to 'applied' (if not set yet)
 *   - interview rounds are cleared when leaving 'interviewing'
 *   - active follow-ups are completed, follow_up_date cleared, and a new
 *     follow-up is created for saved/applied/interviewing/offered
 *   - interview follow-ups (sent_method 'other') are removed when leaving 'interviewing'
 * The companies_sync_job_match trigger then moves the linked Job Inbox match.
 * Every query is scoped to `userId`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const APPLICATION_STATUSES = ["saved", "applied", "interviewing", "offered", "rejected", "withdrawn"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const FOLLOW_UP: Partial<Record<ApplicationStatus, { days: number; message: string }>> = {
	saved: { days: 2, message: "Submit your application" },
	applied: { days: 3, message: "Follow up with recruiter" },
	interviewing: { days: 1, message: "Prepare for interview" },
	offered: { days: 2, message: "Respond to offer" },
};

export async function changeApplicationStatus(
	supabase: SupabaseClient,
	userId: string,
	applicationId: string,
	status: ApplicationStatus
): Promise<{ id: string; name: string; from: string; to: string; changed: boolean } | null> {
	const { data: current, error: readError } = await supabase
		.from("companies")
		.select("id, name, status, applied_at, status_history")
		.eq("id", applicationId)
		.eq("user_id", userId)
		.maybeSingle();
	if (readError) throw new Error(readError.message);
	if (!current) return null;
	if (current.status === status) {
		return { id: current.id, name: current.name, from: current.status, to: status, changed: false };
	}

	const now = new Date().toISOString();
	const update: Record<string, unknown> = {
		status,
		updated_at: now,
		follow_up_date: null,
		status_history: [
			...(Array.isArray(current.status_history) ? current.status_history : []),
			{ from: current.status, to: status, changed_at: now },
		],
	};
	if (status === "applied" && !current.applied_at) update.applied_at = now;
	if (status !== "interviewing") {
		update.interview_rounds = [];
		update.interview_at = null;
	}

	await supabase
		.from("follow_ups")
		.update({ status: "completed" })
		.eq("company_id", applicationId)
		.eq("user_id", userId)
		.eq("status", "active");

	const { error: updateError } = await supabase
		.from("companies")
		.update(update)
		.eq("id", applicationId)
		.eq("user_id", userId);
	if (updateError) throw new Error(updateError.message);

	const fu = FOLLOW_UP[status];
	if (fu) {
		const next = new Date();
		next.setDate(next.getDate() + fu.days);
		const { error } = await supabase.from("follow_ups").insert({
			user_id: userId,
			company_id: applicationId,
			sent_at: now,
			sent_method: "portal",
			next_reminder_at: next.toISOString(),
			reminder_cadence_days: fu.days,
			reminder_count: 1,
			max_reminders: 3,
			status: "active",
			message: fu.message,
		});
		if (error) console.error("[mcp] follow-up insert failed:", error.message);
	}

	if (current.status === "interviewing") {
		await supabase
			.from("follow_ups")
			.delete()
			.eq("company_id", applicationId)
			.eq("user_id", userId)
			.eq("sent_method", "other")
			.eq("status", "active");
	}

	return { id: current.id, name: current.name, from: current.status, to: status, changed: true };
}
