import { NextResponse, type NextRequest } from "next/server";
import type { ZodType } from "zod";

export type ParsedJson<T> =
	| { success: true; data: T }
	| { success: false; response: NextResponse };

export async function parseJson<T>(
	req: NextRequest,
	schema: ZodType<T>
): Promise<ParsedJson<T>> {
	const body = await req.json().catch(() => null);
	const parsed = schema.safeParse(body);
	if (!parsed.success) {
		return {
			success: false,
			response: NextResponse.json(
				{
					error: "Invalid request",
					issues: parsed.error.issues.map(({ path, message }) => ({
						path: path.join("."),
						message,
					})),
				},
				{ status: 400 }
			),
		};
	}
	return { success: true, data: parsed.data };
}

export function getRequestIp(req: NextRequest) {
	return (
		req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		req.headers.get("x-real-ip") ||
		"unknown"
	);
}
