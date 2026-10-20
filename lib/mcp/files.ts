/**
 * Server-only: links to a rendered PDF for MCP callers.
 *
 * The portal link (/api/files/<key>) needs a browser session, so an AI client
 * also gets a short-lived presigned R2 URL it can fetch directly. Path-style
 * addressing works for both R2 and S3-compatible stand-ins (MinIO) locally.
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const PRESIGN_TTL_SECONDS = 15 * 60;

let client: S3Client | null | undefined;

function r2Endpoint(): string | null {
	if (process.env.R2_ENDPOINT) return process.env.R2_ENDPOINT;
	if (process.env.R2_ACCOUNT_ID) return `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	return null;
}

function getClient(): S3Client | null {
	if (client !== undefined) return client;
	const endpoint = r2Endpoint();
	const accessKeyId = process.env.R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
	client =
		endpoint && accessKeyId && secretAccessKey && process.env.R2_BUCKET
			? new S3Client({
					region: "auto",
					endpoint,
					forcePathStyle: true,
					credentials: { accessKeyId, secretAccessKey },
			  })
			: null;
	return client;
}

/** Presigned GET for an R2 key owned by `userId` (keys start with "<userId>/"). */
export async function presignPdf(key: string | null | undefined, userId: string): Promise<string | null> {
	if (!key || !key.startsWith(`${userId}/`)) return null;
	const s3 = getClient();
	if (!s3) return null;
	try {
		return await getSignedUrl(
			s3,
			new GetObjectCommand({
				Bucket: process.env.R2_BUCKET,
				Key: key,
				ResponseContentType: "application/pdf",
			}),
			{ expiresIn: PRESIGN_TTL_SECONDS }
		);
	} catch (err) {
		console.error("[mcp] presign failed:", err instanceof Error ? err.message : err);
		return null;
	}
}
