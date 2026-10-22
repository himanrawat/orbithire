import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { getR2Config } from "@/lib/r2Config";

let client: S3Client | null | undefined;

export function getR2Client() {
	if (client !== undefined) return client;
	const config = getR2Config();
	client = config
		? new S3Client({
				region: "auto",
				endpoint: config.endpoint,
				credentials: {
					accessKeyId: config.accessKeyId,
					secretAccessKey: config.secretAccessKey,
				},
		  })
		: null;
	return client;
}

export function objectBodyToWebStream(body: unknown) {
	if (body instanceof Readable) {
		return Readable.toWeb(body) as ReadableStream<Uint8Array>;
	}
	if (
		body &&
		typeof body === "object" &&
		"transformToWebStream" in body &&
		typeof body.transformToWebStream === "function"
	) {
		return body.transformToWebStream() as ReadableStream<Uint8Array>;
	}
	throw new Error("Unsupported object stream type");
}

export function safeContentDispositionFilename(filename: string) {
	return filename.replaceAll(/[\r\n"\\]/g, "_").slice(0, 200) || "file";
}
