import { NextResponse } from "next/server";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";
import { requireAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET() {
	const admin = await requireAdmin("super_admin");
	if (!admin) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (
		!serverEnv.r2Endpoint ||
		!serverEnv.r2Bucket ||
		!serverEnv.r2AccessKeyId ||
		!serverEnv.r2SecretAccessKey
	) {
		return NextResponse.json({ healthy: false }, { status: 503 });
	}

	const client = new S3Client({
		region: "auto",
		endpoint: serverEnv.r2Endpoint,
		credentials: {
			accessKeyId: serverEnv.r2AccessKeyId,
			secretAccessKey: serverEnv.r2SecretAccessKey,
		},
	});

	try {
		await client.send(new HeadBucketCommand({ Bucket: serverEnv.r2Bucket }));
		return NextResponse.json({ healthy: true });
	} catch {
		return NextResponse.json({ healthy: false }, { status: 503 });
	}
}
