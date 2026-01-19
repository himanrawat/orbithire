import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		// Force dynamic to allow cookies
		req;
		const cookieStore = cookies();
		const adminToken = cookieStore.get("admin_token");

		if (!adminToken) {
			return NextResponse.json(
				{ error: "No admin session" },
				{ status: 401 }
			);
		}

		const supabase = createServiceSupabase();

		const { data: admin, error } = await supabase
		.from("admin_users")
		.select("id, email, name, role, is_active")
		.eq("id", adminToken.value)
		.single();

		if (error || !admin) {
			return NextResponse.json(
				{ error: "Invalid session" },
				{ status: 401 }
			);
		}

		if (!admin.is_active) {
			return NextResponse.json(
				{ error: "Account is deactivated" },
				{ status: 401 }
			);
		}

		return NextResponse.json({
			id: admin.id,
			email: admin.email,
			name: admin.name,
			role: admin.role,
		});
	} catch (error) {
		console.error("Admin verify error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
