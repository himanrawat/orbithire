import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

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

		const body = await request.json();
		const {
			name,
			website,
			industry,
			status,
			jobTitle,
			jobDescription,
			jobUrl,
			recruiterName,
			recruiterEmail,
			salaryRange,
			notes,
			appliedAt,
			followUpDate,
			interviewAt,
			interviewRounds,
		} = body;

		const updateData: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (name !== undefined) updateData.name = name;
		if (website !== undefined) updateData.website = website;
		if (industry !== undefined) updateData.industry = industry;
		if (status !== undefined) updateData.status = status;
		if (jobTitle !== undefined) updateData.job_title = jobTitle;
		if (jobDescription !== undefined)
			updateData.job_description = jobDescription;
		if (jobUrl !== undefined) updateData.job_url = jobUrl;
		if (recruiterName !== undefined) updateData.recruiter_name = recruiterName;
		if (recruiterEmail !== undefined) updateData.recruiter_email = recruiterEmail;
		if (salaryRange !== undefined) updateData.salary_range = salaryRange;
		if (notes !== undefined) updateData.notes = notes;
		if (appliedAt !== undefined) updateData.applied_at = appliedAt;
		if (followUpDate !== undefined) updateData.follow_up_date = followUpDate;
		if (interviewAt !== undefined) updateData.interview_at = interviewAt;
		if (interviewRounds !== undefined)
			updateData.interview_rounds = interviewRounds;

		// If status is changing to 'applied', set applied_at if not already set
		if (status === "applied" && !appliedAt) {
			updateData.applied_at = new Date().toISOString();
		}

		// Clear interview rounds when status changes away from 'interviewing'
		if (status !== undefined && status !== "interviewing") {
			updateData.interview_rounds = [];
			updateData.interview_at = null;
		}

		// Get current company to check if status is changing
		const { data: currentCompany } = await supabase
			.from("companies")
			.select("status, interview_at, interview_rounds, status_history")
			.eq("id", params.id)
			.eq("user_id", user.id)
			.single();

		// Log status change to history
		if (
			status !== undefined &&
			currentCompany &&
			status !== currentCompany.status
		) {
			const currentHistory = currentCompany.status_history || [];
			const newHistoryEntry = {
				from: currentCompany.status,
				to: status,
				changed_at: new Date().toISOString(),
			};
			updateData.status_history = [...currentHistory, newHistoryEntry];

			// Clear follow_up_date when status changes - user knows what's happening
			updateData.follow_up_date = null;

			// Cancel all active follow-ups for this company when status changes
			const { error: cancelFollowUpError } = await supabase
				.from("follow_ups")
				.update({ status: "completed" })
				.eq("company_id", params.id)
				.eq("user_id", user.id)
				.eq("status", "active");

			if (cancelFollowUpError) {
				console.error(
					"[Company API] Error cancelling follow-ups on status change:",
					cancelFollowUpError
				);
			} else {
				console.log(
					"[Company API] Cancelled active follow-ups due to status change:",
					{ from: currentCompany.status, to: status }
				);
			}
		}

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

		// Create follow-up for status changes (except rejected/withdrawn which need no follow-up)
		// Follow-up reminders are created for: saved, applied, interviewing, offered
		const statusesNeedingFollowUp = [
			"saved",
			"applied",
			"interviewing",
			"offered",
		];
		if (
			status !== undefined &&
			currentCompany?.status !== status &&
			statusesNeedingFollowUp.includes(status)
		) {
			// Determine reminder cadence based on status
			let reminderDays = 3;
			let reminderMessage = "";

			switch (status) {
				case "saved":
					reminderDays = 2; // Remind in 2 days to apply
					reminderMessage = "Submit your application";
					break;
				case "applied":
					reminderDays = 3; // Remind in 3 days to follow up
					reminderMessage = "Follow up with recruiter";
					break;
				case "interviewing":
					reminderDays = 1; // Remind in 1 day for interview prep
					reminderMessage = "Prepare for interview";
					break;
				case "offered":
					reminderDays = 2; // Remind in 2 days to respond
					reminderMessage = "Respond to offer";
					break;
			}

			const nextReminderAt = new Date();
			nextReminderAt.setDate(nextReminderAt.getDate() + reminderDays);

			console.log("[Company API] Creating follow-up for status:", {
				user_id: user.id,
				company_id: params.id,
				previousStatus: currentCompany?.status,
				newStatus: status,
				reminderMessage,
				next_reminder_at: nextReminderAt.toISOString(),
			});

			const { data: followUpData, error: followUpError } = await supabase
				.from("follow_ups")
				.insert({
					user_id: user.id,
					company_id: params.id,
					sent_at: new Date().toISOString(),
					sent_method: "portal",
					next_reminder_at: nextReminderAt.toISOString(),
					reminder_cadence_days: reminderDays,
					reminder_count: 1,
					max_reminders: 3,
					status: "active",
					message: reminderMessage,
				})
				.select()
				.single();

			if (followUpError) {
				console.error("[Company API] Error creating follow-up:", followUpError);
			} else {
				console.log(
					"[Company API] Follow-up created successfully:",
					followUpData
				);
			}
		}

		// Create follow-ups for each interview round if status is interviewing and interviewRounds is set
		if (
			status === "interviewing" &&
			Array.isArray(interviewRounds) &&
			interviewRounds.length > 0
		) {
			// Only create follow-ups for new rounds (not already present in currentCompany)
			const prevRounds = Array.isArray(currentCompany?.interview_rounds)
				? currentCompany.interview_rounds
				: [];
			const prevDates = new Set(prevRounds.map((r: any) => r.date));
			for (const round of interviewRounds) {
				if (round.date && !prevDates.has(round.date)) {
					// Prevent duplicate follow-ups for the same date
					const { data: existingFollowUp } = await supabase
						.from("follow_ups")
						.select("id")
						.eq("company_id", params.id)
						.eq("user_id", user.id)
						.eq("next_reminder_at", new Date(round.date).toISOString())
						.maybeSingle();
					if (!existingFollowUp) {
						const interviewDate = new Date(round.date);
						const reminderDate = new Date(interviewDate);
						reminderDate.setDate(reminderDate.getDate() - 1);
						const now = new Date();
						const nextReminderAt = reminderDate > now ? reminderDate : now;
						await supabase.from("follow_ups").insert({
							user_id: user.id,
							company_id: params.id,
							sent_at: new Date().toISOString(),
							sent_method: "other",
							next_reminder_at: nextReminderAt.toISOString(),
							reminder_cadence_days: 0,
							reminder_count: 0,
							max_reminders: 1,
							status: "active",
						});
					}
				}
			}
		}

		// Delete interview-related follow-ups when status changes away from 'interviewing'
		if (
			status !== "interviewing" &&
			currentCompany?.status === "interviewing"
		) {
			// Delete follow-ups that were created for interview reminders (sent_method: "other")
			await supabase
				.from("follow_ups")
				.delete()
				.eq("company_id", params.id)
				.eq("user_id", user.id)
				.eq("sent_method", "other")
				.eq("status", "active");

			console.log(
				"[Company API] Deleted interview follow-ups for company:",
				params.id
			);
		}

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
