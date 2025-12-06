import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/config";

type ProfilePayload = {
	fullName: string;
	headline?: string;
	location?: string;
};

type ResumePayload = {
	skills?: string;
	experience?: string;
	education?: string;
	file?: {
		name?: string;
		type?: string;
		size?: number;
	};
};

type PreferencesPayload = {
	jobTitles?: string;
	locations?: string;
	workType?: string;
	salaryRange?: string;
	startDate?: string;
};

const allowedResumeTypes = new Set([
	"application/pdf",
	"application/msword",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function splitList(value?: string) {
	return (value || "")
		.split(/[,\n]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function normalizeFileType(name?: string, type?: string) {
	if (type && allowedResumeTypes.has(type)) {
		return type;
	}
	if (!name) return null;
	const lower = name.toLowerCase();
	if (lower.endsWith(".pdf")) return "application/pdf";
	if (lower.endsWith(".doc")) return "application/msword";
	if (lower.endsWith(".docx"))
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
	return null;
}

export async function POST(req: NextRequest) {
	const supabaseResponse = NextResponse.next();

	const supabase = createServerClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseAnonKey,
		{
			cookies: {
				get(name: string) {
					return req.cookies.get(name)?.value;
				},
				set(name: string, value: string, options: any) {
					supabaseResponse.cookies.set({
						name,
						value,
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						domain: serverEnv.authCookieDomain,
						path: "/",
						...options,
					});
				},
				remove(name: string, options: any) {
					supabaseResponse.cookies.set({
						name,
						value: "",
						expires: new Date(0),
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						domain: serverEnv.authCookieDomain,
						path: "/",
						...options,
					});
				},
			},
		}
	);

	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session) {
		return NextResponse.json(
			{ error: "Not authenticated." },
			{ status: 401, headers: supabaseResponse.headers }
		);
	}

	const body = await req.json().catch(() => null);
	if (!body || typeof body !== "object") {
		return NextResponse.json(
			{ error: "Invalid request body." },
			{ status: 400, headers: supabaseResponse.headers }
		);
	}

	const profile: ProfilePayload = body.profile || {};
	const resume: ResumePayload = body.resume || {};
	const preferences: PreferencesPayload = body.preferences || {};

	if (!profile.fullName || typeof profile.fullName !== "string") {
		return NextResponse.json(
			{ error: "Full name is required." },
			{ status: 400, headers: supabaseResponse.headers }
		);
	}

	const resumeFileType = normalizeFileType(
		resume.file?.name,
		resume.file?.type
	);

	if (resume.file?.size && resume.file.size > serverEnv.maxUploadBytes) {
		return NextResponse.json(
			{
				error: "Resume file is too large. Please keep it under 5MB.",
			},
			{ status: 400, headers: supabaseResponse.headers }
		);
	}

	if (resume.file && resume.file.name && !resumeFileType) {
		return NextResponse.json(
			{
				error:
					"Unsupported resume type. Use PDF, DOC, or DOCX up to 5MB.",
			},
			{ status: 400, headers: supabaseResponse.headers }
		);
	}

	if (!serverEnv.supabaseServiceRoleKey) {
		return NextResponse.json(
			{
				error:
					"Server is missing Supabase service role configuration. Add SUPABASE_SERVICE_ROLE_KEY.",
			},
			{ status: 503, headers: supabaseResponse.headers }
		);
	}

	const skills = splitList(resume.skills);
	const jobTitles = splitList(preferences.jobTitles);
	const preferredLocations = splitList(preferences.locations);

	const admin = createClient(
		serverEnv.supabaseUrl,
		serverEnv.supabaseServiceRoleKey
	);

	const { error: profileError } = await admin
		.from("profiles")
		.upsert({
			id: session.user.id,
			name: profile.fullName.trim(),
			headline: profile.headline?.trim() || null,
			location: profile.location?.trim() || null,
			summary: resume.experience?.trim() || null,
			skills: skills.length ? skills : null,
			updated_at: new Date().toISOString(),
		})
		.select("id")
		.single();

	if (profileError) {
		return NextResponse.json(
			{ error: "Unable to save profile right now." },
			{ status: 500, headers: supabaseResponse.headers }
		);
	}

	return NextResponse.json(
		{
			ok: true,
			savedProfile: true,
			normalized: {
				skills,
				jobTitles,
				preferredLocations,
				workType: preferences.workType || null,
				startDate: preferences.startDate || null,
				resumeFileAccepted: Boolean(resume.file?.name),
			},
		},
		{ status: 200, headers: supabaseResponse.headers }
	);
}
