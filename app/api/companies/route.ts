import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const runtime = "nodejs";

// GET /api/companies - List all companies for the current user
export async function GET() {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: companies, error } = await supabase
			.from("companies")
			.select(
				`
				id,
				name,
				website,
				industry,
				notes,
				status,
				job_title,
				job_description,
				job_url,
				recruiter_name,
				salary_range,
				applied_at,
				follow_up_date,
				created_at,
				updated_at,
				resumes (id),
				cover_letters (id)
			`
			)
			.eq("user_id", user.id)
			.order("updated_at", { ascending: false });

		if (error) {
			console.error("Error fetching companies:", error);
			return NextResponse.json(
				{ error: "Failed to fetch companies" },
				{ status: 500 }
			);
		}

		// Transform the data to include counts
		const companiesWithCounts = (companies || []).map((company: any) => ({
			...company,
			resumeCount: company.resumes?.length || 0,
			coverLetterCount: company.cover_letters?.length || 0,
			resumes: undefined,
			cover_letters: undefined,
		}));

		return NextResponse.json({ companies: companiesWithCounts });
	} catch (error) {
		console.error("Companies GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// POST /api/companies - Create a new company with resume and cover letter
export async function POST(request: NextRequest) {
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
			status = "applied",
			jobTitle,
			jobDescription,
			jobUrl,
			recruiterName,
			salaryRange,
			notes,
			appliedAt,
			followUpDate,
			resume,
			coverLetter,
			templateId,
		} = body;

		if (!name) {
			return NextResponse.json(
				{ error: "Company name is required" },
				{ status: 400 }
			);
		}

		// Create the company record
		const { data: company, error: companyError } = await supabase
			.from("companies")
			.insert({
				user_id: user.id,
				name,
				website,
				industry,
				status,
				job_title: jobTitle,
				job_description: jobDescription,
				job_url: jobUrl,
				recruiter_name: recruiterName,
				salary_range: salaryRange,
				notes,
				applied_at:
					appliedAt || (status === "applied" ? new Date().toISOString() : null),
				follow_up_date: followUpDate,
			})
			.select()
			.single();

		if (companyError) {
			console.error("Error creating company:", companyError);
			return NextResponse.json(
				{ error: "Failed to create company" },
				{ status: 500 }
			);
		}

		let resumeRecord = null;
		let coverLetterRecord = null;

		// Create the resume record if provided
		if (resume) {
			const { data: resumeData, error: resumeError } = await supabase
				.from("resumes")
				.insert({
					user_id: user.id,
					company_id: company.id,
					title: `${jobTitle} at ${name}`,
					content_json: resume,
					job_description: jobDescription,
					template: templateId || "standard",
				})
				.select()
				.single();

			if (resumeError) {
				console.error("Error creating resume:", resumeError);
			} else {
				resumeRecord = resumeData;
			}
		}

		// Create the cover letter record if provided
		if (coverLetter) {
			const { data: coverLetterData, error: coverLetterError } = await supabase
				.from("cover_letters")
				.insert({
					user_id: user.id,
					company_id: company.id,
					resume_id: resumeRecord?.id,
					title: `Cover Letter - ${jobTitle} at ${name}`,
					content: coverLetter,
					job_description: jobDescription,
				})
				.select()
				.single();

			if (coverLetterError) {
				console.error("Error creating cover letter:", coverLetterError);
			} else {
				coverLetterRecord = coverLetterData;
			}
		}

		return NextResponse.json({
			success: true,
			company,
			resume: resumeRecord,
			coverLetter: coverLetterRecord,
		});
	} catch (error) {
		console.error("Companies POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
