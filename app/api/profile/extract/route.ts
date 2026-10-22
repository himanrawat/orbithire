import type { NextRequest } from "next/server";
import { extractProfile } from "@/lib/profileExtraction/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	return extractProfile(req);
}
