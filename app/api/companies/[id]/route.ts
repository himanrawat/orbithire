import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { parseJson } from "@/lib/api";
import { companyUpdateSchema } from "@/lib/schemas/api";
import type { z } from "zod";

export const runtime = "nodejs";

type CompanyUpdate = z.input<typeof companyUpdateSchema>;
type SupabaseClient = ReturnType<typeof createServerSupabase>;
type CurrentCompany = {
	status: string | null;
	interview_at: string | null;
	interview_rounds: unknown;
	status_history: unknown;
};

const COMPANY_FIELD_MAP = {
	name: "name",
	website: "website",
	industry: "industry",
	status: "status",
	jobTitle: "job_title",
	jobDescription: "job_description",
	jobUrl: "job_url",
	recruiterName: "recruiter_name",
	recruiterEmail: "recruiter_email",
	salaryRange: "salary_range",
	notes: "notes",
	appliedAt: "applied_at",
	followUpDate: "follow_up_date",
	interviewAt: "interview_at",
	interviewRounds: "interview_rounds",
} as const;

const FOLLOW_UP_CONFIG: Record<string, { days: number; message: string }> = {
	saved: { days: 2, message: "Submit your application" },
	applied: { days: 3, message: "Follow up with recruiter" },
	interviewing: { days: 1, message: "Prepare for interview" },
	offered: { days: 2, message: "Respond to offer" },
};

function buildCompanyUpdate(body: CompanyUpdate) {
	const updateData: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
	};
	const source = body as Record<string, unknown>;

	for (const [inputName, columnName] of Object.entries(COMPANY_FIELD_MAP)) {
		if (source[inputName] !== undefined) updateData[columnName] = source[inputName];
	}

	if (body.status === "applied" && !body.appliedAt) {
		updateData.applied_at = new Date().toISOString();
	}
	if (body.status !== undefined && body.status !== "interviewing") {
		updateData.interview_rounds = [];
		updateData.interview_at = null;
	}

	return updateData;
}

function applyStatusHistory(
	updateData: Record<string, unknown>,
	currentCompany: CurrentCompany | null,
	status: CompanyUpdate["status"]
) {
	if (status === undefined || !currentCompany || status === currentCompany.status) return false;
	const currentHistory = Array.isArray(currentCompany.status_history) ? currentCompany.status_history : [];
	updateData.status_history = [
		...currentHistory,
		{ from: currentCompany.status, to: status, changed_at: new Date().toISOString() },
	];
	updateData.follow_up_date = null;
	return true;
}

async function cancelActiveFollowUps(supabase: SupabaseClient, companyId: string, userId: string) {
	const { error } = await supabase
		.from("follow_ups")
		.update({ status: "completed" })
		.eq("company_id", companyId)
		.eq("user_id", userId)
		.eq("status", "active");

	if (error) console.error("[Company API] Error cancelling follow-ups on status change:", error);
}

async function createStatusFollowUp(
	supabase: SupabaseClient,
	companyId: string,
	userId: string,
	status: CompanyUpdate["status"],
	previousStatus: string | null | undefined
) {
	if (typeof status !== "string" || status === previousStatus) return;
	const config = FOLLOW_UP_CONFIG[status];
	if (!config) return;

	const nextReminderAt = new Date();
	nextReminderAt.setDate(nextReminderAt.getDate() + config.days);
	const { error } = await supabase.from("follow_ups").insert({
		user_id: userId,
		company_id: companyId,
		sent_at: new Date().toISOString(),
		sent_method: "portal",
		next_reminder_at: nextReminderAt.toISOString(),
		reminder_cadence_days: config.days,
		reminder_count: 1,
		max_reminders: 3,
		status: "active",
		message: config.message,
	});

	if (error) console.error("[Company API] Error creating follow-up:", error);
}

function getPreviousRoundDates(currentCompany: CurrentCompany | null) {
	if (!Array.isArray(currentCompany?.interview_rounds)) return new Set<string>();
	return new Set(
		currentCompany.interview_rounds
			.map((round) => (typeof round === "object" && round && "date" in round ? String(round.date) : null))
			.filter((date): date is string => date !== null)
	);
}

async function createInterviewFollowUps(
	supabase: SupabaseClient,
	companyId: string,
	userId: string,
	body: CompanyUpdate,
	currentCompany: CurrentCompany | null
) {
	if (body.status !== "interviewing" || !body.interviewRounds?.length) return;
	const previousDates = getPreviousRoundDates(currentCompany);
	const newRounds = body.interviewRounds.filter((round) => !previousDates.has(round.date));
	if (newRounds.length === 0) return;

	const { data: existingFollowUps } = await supabase
		.from("follow_ups")
		.select("next_reminder_at")
		.eq("company_id", companyId)
		.eq("user_id", userId);
	const existingDates = new Set((existingFollowUps ?? []).map((followUp) => followUp.next_reminder_at));
	const now = new Date();
	const rows = newRounds
		.filter((round) => !existingDates.has(new Date(round.date).toISOString()))
		.map((round) => {
			const reminderDate = new Date(round.date);
			reminderDate.setDate(reminderDate.getDate() - 1);
			return {
				user_id: userId,
				company_id: companyId,
				sent_at: new Date().toISOString(),
				sent_method: "other",
				next_reminder_at: (reminderDate > now ? reminderDate : now).toISOString(),
				reminder_cadence_days: 0,
				reminder_count: 0,
				max_reminders: 1,
				status: "active",
			};
		});

	if (rows.length > 0) await supabase.from("follow_ups").insert(rows);
}

async function deleteInterviewFollowUps(
	supabase: SupabaseClient,
	companyId: string,
	userId: string,
	status: CompanyUpdate["status"],
	previousStatus: string | null | undefined
) {
	if (status === "interviewing" || previousStatus !== "interviewing") return;
	await supabase
		.from("follow_ups")
		.delete()
		.eq("company_id", companyId)
		.eq("user_id", userId)
		.eq("sent_method", "other")
		.eq("status", "active");
}

// GET /api/companies/[id] - Get a single company with its resumes and cover letters
export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: company, error } = await supabase
			.from("companies")
			.select(
				`
				       *,
				       resumes (*),
				       cover_letters (*),
				       interview_rounds
			       `
			)
			.eq("id", params.id)
			.eq("user_id", user.id)
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				return NextResponse.json(
					{ error: "Company not found" },
					{ status: 404 }
				);
			}
			console.error("Error fetching company:", error);
			return NextResponse.json(
				{ error: "Failed to fetch company" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ company });
	} catch (error) {
		console.error("Company GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// PATCH /api/companies/[id] - Update a company
export async function PATCH(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(request, companyUpdateSchema);
		if (!parsed.success) return parsed.response;
		const body = parsed.data;
		const updateData = buildCompanyUpdate(body);

		// Get current company to check if status is changing
		const { data: currentCompany } = await supabase
			.from("companies")
			.select("status, interview_at, interview_rounds, status_history")
			.eq("id", params.id)
			.eq("user_id", user.id)
			.single();

		const statusChanged = applyStatusHistory(updateData, currentCompany, body.status);
		if (statusChanged) await cancelActiveFollowUps(supabase, params.id, user.id);

		const { data: company, error } = await supabase
			.from("companies")
			.update(updateData)
			.eq("id", params.id)
			.eq("user_id", user.id)
			.select()
			.single();

		if (error) {
			if (error.code === "PGRST116") {
				return NextResponse.json(
					{ error: "Company not found" },
					{ status: 404 }
				);
			}
			console.error("Error updating company:", error);
			return NextResponse.json(
				{ error: "Failed to update company" },
				{ status: 500 }
			);
		}

		await createStatusFollowUp(supabase, params.id, user.id, body.status, currentCompany?.status);
		await createInterviewFollowUps(supabase, params.id, user.id, body, currentCompany);
		await deleteInterviewFollowUps(supabase, params.id, user.id, body.status, currentCompany?.status);

		return NextResponse.json({ success: true, company });
	} catch (error) {
		console.error("Company PATCH error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// DELETE /api/companies/[id] - Delete a company and all associated data
export async function DELETE(
	request: NextRequest,
	{ params }: { params: { id: string } }
) {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// First verify the company belongs to the user
		const { data: company, error: fetchError } = await supabase
			.from("companies")
			.select("id")
			.eq("id", params.id)
			.eq("user_id", user.id)
			.single();

		if (fetchError || !company) {
			return NextResponse.json({ error: "Company not found" }, { status: 404 });
		}

		// Delete associated cover letters first (they reference resumes)
		await supabase.from("cover_letters").delete().eq("company_id", params.id);

		// Delete associated resumes
		await supabase.from("resumes").delete().eq("company_id", params.id);

		// Delete associated follow-ups
		await supabase.from("follow_ups").delete().eq("company_id", params.id);

		// Finally delete the company
		const { error: deleteError } = await supabase
			.from("companies")
			.delete()
			.eq("id", params.id)
			.eq("user_id", user.id);

		if (deleteError) {
			console.error("Error deleting company:", deleteError);
			return NextResponse.json(
				{ error: "Failed to delete company" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Company DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
