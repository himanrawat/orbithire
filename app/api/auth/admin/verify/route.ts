import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
	try {
		// Reading the request keeps this handler dynamic alongside the exported flag.
		void req.url;
		const admin = await requireAdmin();
		if (!admin) {
			return NextResponse.json(
				{ error: "Invalid or expired admin session" },
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
