import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { serverEnv } from "./config";

// Initialize R2 client
function getR2Client(): S3Client | null {
	if (
		!serverEnv.r2Endpoint ||
		!serverEnv.r2Bucket ||
		!serverEnv.r2AccessKeyId ||
		!serverEnv.r2SecretAccessKey
	) {
		console.warn("R2 environment variables are not fully configured");
		return null;
	}

	return new S3Client({
		region: "auto",
		endpoint: serverEnv.r2Endpoint,
		credentials: {
			accessKeyId: serverEnv.r2AccessKeyId,
			secretAccessKey: serverEnv.r2SecretAccessKey,
		},
	});
}

export interface UploadResult {
	success: boolean;
	url?: string;
	error?: string;
}

/**
 * Upload a file buffer to R2
 * @param buffer - File buffer to upload
 * @param key - The object key (path) in R2
 * @param contentType - MIME type of the file
 * @returns Upload result with proxy URL (works with private buckets)
 */
export async function uploadToR2(
	buffer: Buffer,
	key: string,
	contentType: string
): Promise<UploadResult> {
	const client = getR2Client();

	if (!client) {
		return {
			success: false,
			error: "R2 is not configured",
		};
	}

	try {
		await client.send(
			new PutObjectCommand({
				Bucket: serverEnv.r2Bucket,
				Key: key,
				Body: buffer,
				ContentType: contentType,
			})
		);

		// Return proxy URL instead of public URL (works with private buckets)
		// The /api/files endpoint will authenticate and proxy the file
		const proxyUrl = `/api/files/${key}`;

		return {
			success: true,
			url: proxyUrl,
		};
	} catch (error) {
		console.error("R2 upload error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Upload failed",
		};
	}
}

/**
 * Generate a unique file key for R2 storage
 * @param userId - User ID
 * @param type - File type (resume, cover-letter)
 * @param companyName - Company name for folder organization
 * @param extension - File extension (pdf, docx)
 */
export function generateFileKey(
	userId: string,
	type: "resume" | "cover-letter",
	companyName: string,
	extension: "pdf" | "docx"
): string {
	const timestamp = Date.now();
	const sanitizedCompany = companyName
		.toLowerCase()
		.replaceAll(/[^a-z0-9]/g, "-")
		.substring(0, 50);

	return `${userId}/${type}s/${sanitizedCompany}-${timestamp}.${extension}`;
}
