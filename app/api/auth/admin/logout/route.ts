import { NextResponse } from "next/server";
import { revokeCurrentAdminSession } from "@/lib/adminAuth";

export async function POST() {
	try {
		await revokeCurrentAdminSession();

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Admin logout error:", error);
		return NextResponse.json(
			{ error: "Something went wrong" },
			{ status: 500 }
		);
	}
}
