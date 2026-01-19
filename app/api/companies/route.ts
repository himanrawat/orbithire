import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	generatePDFFromHTML,
	generateCoverLetterPDF,
} from "@/lib/pdfGenerator";
import { uploadToR2, generateFileKey } from "@/lib/r2";
import { serverEnv } from "@/lib/config";

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
			recruiterEmail,
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
				recruiter_email: recruiterEmail,
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

		// Create a follow-up for the new company based on its status
		const followUpConfig: Record<string, { days: number; message: string }> = {
			saved: { days: 2, message: "Submit your application" },
			applied: { days: 3, message: "Follow up with recruiter" },
			interviewing: { days: 1, message: "Prepare for interview" },
			offered: { days: 2, message: "Respond to offer" },
		};

		const config = followUpConfig[status] || {
			days: 3,
			message: "Check on this application",
		};
		const followUpReminderDate = new Date();
		followUpReminderDate.setDate(followUpReminderDate.getDate() + config.days);

		console.log("[Company POST] Creating follow-up for new company:", {
			user_id: user.id,
			company_id: company.id,
			companyName: name,
			status,
			message: config.message,
			next_reminder_at: followUpReminderDate.toISOString(),
		});

		const { data: followUpData, error: followUpError } = await supabase
			.from("follow_ups")
			.insert({
				user_id: user.id,
				company_id: company.id,
				sent_at: new Date().toISOString(),
				sent_method: "portal",
				next_reminder_at: followUpReminderDate.toISOString(),
				status: "active",
				reminder_count: 1,
				message: config.message,
			})
			.select()
			.single();

		if (followUpError) {
			console.error("[Company POST] Error creating follow-up:", followUpError);
			// Don't fail the request, just log the error
		} else {
			console.log(
				"[Company POST] Follow-up created successfully:",
				followUpData
			);
			// Update company's follow_up_date
			await supabase
				.from("companies")
				.update({ follow_up_date: followUpReminderDate.toISOString() })
				.eq("id", company.id);
		}

		let resumeRecord = null;
		let coverLetterRecord = null;
		let resumePdfUrl: string | null = null;
		let coverLetterPdfUrl: string | null = null;

		// Generate Resume PDF and upload to R2 if resume is provided
		if (resume) {
			try {
				// Call the render API to get HTML
				const renderResponse = await fetch(
					`${serverEnv.siteUrl}/api/resume/render`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							resume,
							templateId: templateId || "compact",
						}),
					}
				);

				if (renderResponse.ok) {
					const { html } = await renderResponse.json();

					// Generate PDF from HTML
					const pdfResult = await generatePDFFromHTML(html);

					if (pdfResult.success && pdfResult.buffer) {
						// Upload to R2
						const fileKey = generateFileKey(user.id, "resume", name, "pdf");
						const uploadResult = await uploadToR2(
							pdfResult.buffer,
							fileKey,
							"application/pdf"
						);

						if (uploadResult.success && uploadResult.url) {
							resumePdfUrl = uploadResult.url;
						} else {
							console.error("Resume PDF upload failed:", uploadResult.error);
						}
					} else {
						console.error("Resume PDF generation failed:", pdfResult.error);
					}
				}
			} catch (err) {
				console.error("Resume PDF generation/upload error:", err);
			}

			// Create the resume record
			const { data: resumeData, error: resumeError } = await supabase
				.from("resumes")
				.insert({
					user_id: user.id,
					company_id: company.id,
					title: `${jobTitle} at ${name}`,
					content_json: resume,
					job_description: jobDescription,
					template: templateId || "standard",
					pdf_url: resumePdfUrl,
				})
				.select()
				.single();

			if (resumeError) {
				console.error("Error creating resume:", resumeError);
			} else {
				resumeRecord = resumeData;
			}
		}

		// Generate Cover Letter PDF and upload to R2 if provided
		if (coverLetter) {
			try {
				// Get candidate name from resume basics
				const candidateName = resume?.basics?.name || "Candidate";

				// Generate PDF from cover letter content
				const pdfResult = await generateCoverLetterPDF(
					coverLetter,
					candidateName,
					name,
					jobTitle || "Position"
				);

				if (pdfResult.success && pdfResult.buffer) {
					// Upload to R2
					const fileKey = generateFileKey(user.id, "cover-letter", name, "pdf");
					const uploadResult = await uploadToR2(
						pdfResult.buffer,
						fileKey,
						"application/pdf"
					);

					if (uploadResult.success && uploadResult.url) {
						coverLetterPdfUrl = uploadResult.url;
					} else {
						console.error(
							"Cover letter PDF upload failed:",
							uploadResult.error
						);
					}
				} else {
					console.error("Cover letter PDF generation failed:", pdfResult.error);
				}
			} catch (err) {
				console.error("Cover letter PDF generation/upload error:", err);
			}

			// Create the cover letter record
			const { data: coverLetterData, error: coverLetterError } = await supabase
				.from("cover_letters")
				.insert({
					user_id: user.id,
					company_id: company.id,
					resume_id: resumeRecord?.id,
					title: `Cover Letter - ${jobTitle} at ${name}`,
					content: coverLetter,
					job_description: jobDescription,
					pdf_url: coverLetterPdfUrl,
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
