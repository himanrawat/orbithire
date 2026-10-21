import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
	coverLetterJsonFromText,
	insertDocumentVersion,
	letterBasicsFromResume,
	queueTypstRender,
} from "@/lib/documents";
import { getTypstTemplate } from "@/lib/typstTemplates";
import { DEFAULT_TYPST_COVER, resolveTemplateId } from "@/lib/templateCatalog";

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
			coverLetterTemplateId,
			existingCompanyId,
		} = body;

		// Documents are rendered by the worker (render_pdf task) with Typst.
		// Legacy HTML template ids from old clients map to their Typst equivalent.
		const resumeTemplateId = resolveTemplateId("resume", templateId);
		const t = await getTypstTemplate(resumeTemplateId);
		if (!t || t.kind !== "resume") {
			return NextResponse.json(
				{ error: `Unknown resume template: ${templateId}` },
				{ status: 400 }
			);
		}
		let coverTemplate: string = DEFAULT_TYPST_COVER;
		if (coverLetterTemplateId) {
			const ct = await getTypstTemplate(resolveTemplateId("cover_letter", coverLetterTemplateId));
			if (ct && ct.kind === "cover_letter") coverTemplate = ct.id;
		}

		if (!name) {
			return NextResponse.json(
				{ error: "Company name is required" },
				{ status: 400 }
			);
		}

		// Job Inbox: if this job already has an application, attach the documents
		// to it instead of creating a duplicate (and a second follow-up).
		let company: { id: string; [key: string]: unknown } | null = null;
		if (existingCompanyId) {
			const { data: existing } = await supabase
				.from("companies")
				.select()
				.eq("id", String(existingCompanyId))
				.eq("user_id", user.id)
				.maybeSingle();
			company = existing;
		}

		if (!company) {
			// Create the company record
			const { data: created, error: companyError } = await supabase
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

			if (companyError || !created) {
				console.error("Error creating company:", companyError);
				return NextResponse.json(
					{ error: "Failed to create company" },
					{ status: 500 }
				);
			}
			company = created;
			const newCompanyId: string = created.id;

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
				company_id: newCompanyId,
				companyName: name,
				status,
				message: config.message,
				next_reminder_at: followUpReminderDate.toISOString(),
			});

			const { data: followUpData, error: followUpError } = await supabase
				.from("follow_ups")
				.insert({
					user_id: user.id,
					company_id: newCompanyId,
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
					.eq("id", newCompanyId);
			}
		}
		if (!company) {
			return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
		}

		let resumeRecord: Record<string, unknown> | null = null;
		let coverLetterRecord: Record<string, unknown> | null = null;
		const pdfErrors: { document: "resume" | "cover_letter"; error: string }[] = [];

		if (resume) {
			const { data: resumeData, error: resumeError } = await supabase
				.from("resumes")
				.insert({
					user_id: user.id,
					company_id: company.id,
					title: `${jobTitle} at ${name}`,
					content_json: resume,
					job_description: jobDescription,
					template: resumeTemplateId,
					engine: "typst",
					source: "portal",
					pdf_status: "queued",
				})
				.select()
				.single();

			if (resumeError) {
				console.error("Error creating resume:", resumeError);
				pdfErrors.push({ document: "resume", error: "Failed to save resume" });
			} else {
				resumeRecord = resumeData;
				await insertDocumentVersion(supabase, {
					userId: user.id,
					type: "resume",
					documentId: resumeData.id,
					contentJson: resume,
				});
				const q = await queueTypstRender({
					type: "resume",
					documentId: resumeData.id,
					userId: user.id,
					templateId: resumeData.template,
				});
				if (!q.ok) pdfErrors.push({ document: "resume", error: q.error || "Could not queue PDF" });
			}
		}

		if (coverLetter) {
			const contentJson = coverLetterJsonFromText({
				text: coverLetter,
				basics: letterBasicsFromResume(resume),
				companyName: name,
				recruiterName,
				jobTitle,
			});
			const { data: coverLetterData, error: coverLetterError } = await supabase
				.from("cover_letters")
				.insert({
					user_id: user.id,
					company_id: company.id,
					resume_id: resumeRecord?.id,
					title: `Cover Letter - ${jobTitle} at ${name}`,
					content: coverLetter,
					content_json: contentJson,
					job_description: jobDescription,
					engine: "typst",
					template: coverTemplate,
					source: "portal",
					pdf_status: "queued",
				})
				.select()
				.single();

			if (coverLetterError) {
				console.error("Error creating cover letter:", coverLetterError);
				pdfErrors.push({ document: "cover_letter", error: "Failed to save cover letter" });
			} else {
				coverLetterRecord = coverLetterData;
				await insertDocumentVersion(supabase, {
					userId: user.id,
					type: "cover_letter",
					documentId: coverLetterData.id,
					contentJson,
				});
				const q = await queueTypstRender({
					type: "cover_letter",
					documentId: coverLetterData.id,
					userId: user.id,
					templateId: coverTemplate,
				});
				if (!q.ok) pdfErrors.push({ document: "cover_letter", error: q.error || "Could not queue PDF" });
			}
		}

		return NextResponse.json({
			success: true,
			company,
			resume: resumeRecord,
			coverLetter: coverLetterRecord,
			engine: "typst",
			pdfErrors,
		});
	} catch (error) {
		console.error("Companies POST error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
