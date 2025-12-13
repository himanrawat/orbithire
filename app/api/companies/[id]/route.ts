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
				cover_letters (*)
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
			salaryRange,
			notes,
			appliedAt,
			followUpDate,
		} = body;

		const updateData: Record<string, any> = {
			updated_at: new Date().toISOString(),
		};

		if (name !== undefined) updateData.name = name;
		if (website !== undefined) updateData.website = website;
		if (industry !== undefined) updateData.industry = industry;
		if (status !== undefined) updateData.status = status;
		if (jobTitle !== undefined) updateData.job_title = jobTitle;
		if (jobDescription !== undefined) updateData.job_description = jobDescription;
		if (jobUrl !== undefined) updateData.job_url = jobUrl;
		if (recruiterName !== undefined) updateData.recruiter_name = recruiterName;
		if (salaryRange !== undefined) updateData.salary_range = salaryRange;
		if (notes !== undefined) updateData.notes = notes;
		if (appliedAt !== undefined) updateData.applied_at = appliedAt;
		if (followUpDate !== undefined) updateData.follow_up_date = followUpDate;

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
			return NextResponse.json(
				{ error: "Company not found" },
				{ status: 404 }
			);
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
