import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { serverEnv } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
	if (
		!serverEnv.r2Endpoint ||
		!serverEnv.r2Bucket ||
		!serverEnv.r2AccessKeyId ||
		!serverEnv.r2SecretAccessKey
	) {
		return NextResponse.json(
			{
				success: false,
				error: "R2 environment variables are not fully configured.",
			},
			{ status: 500 }
		);
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
		const result = await client.send(
			new ListObjectsV2Command({
				Bucket: serverEnv.r2Bucket,
				MaxKeys: 5,
			})
		);

		return NextResponse.json({
			success: true,
			files: result.Contents || [],
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: String(error),
			},
			{ status: 500 }
		);
	}
}
