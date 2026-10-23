import "server-only";

import {
	DeleteObjectsCommand,
	ListObjectsV2Command,
	type S3Client,
} from "@aws-sdk/client-s3";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getR2Client } from "@/lib/r2Object";
import { getR2Config } from "@/lib/r2Config";
import { createServiceSupabase } from "@/lib/supabaseServer";
import {
	EXPORT_ROW_LIMIT,
	EXPORT_TABLES,
	stripOmittedColumns,
	type AccountExport,
	type ExportRow,
	type ExportTableSpec,
} from "@/lib/account/export";
import { R2_DELETE_BATCH_SIZE, chunk, userStoragePrefix } from "@/lib/account/delete";

// ==================== Export ====================

type TableResult = { table: string; rows: ExportRow[] | null };

async function readTable(
	supabase: SupabaseClient,
	userId: string,
	spec: ExportTableSpec
): Promise<TableResult> {
	const { data, error } = await supabase
		.from(spec.table)
		.select("*")
		.eq(spec.ownerColumn, userId)
		.limit(EXPORT_ROW_LIMIT);
	if (error) {
		console.error(`[account/export] ${spec.table}:`, error.message);
		return { table: spec.table, rows: null };
	}
	return { table: spec.table, rows: stripOmittedColumns(data ?? [], spec.omit) };
}

/**
 * Collects every exportable row for the signed-in user. Reads go through the user's
 * own client, so RLS limits them to the user's rows. The tables are independent and
 * the list is short and fixed, so they are read concurrently.
 */
export async function collectAccountExport(
	supabase: SupabaseClient,
	user: Readonly<{ id: string; email?: string | null }>
): Promise<AccountExport> {
	const results = await Promise.all(
		EXPORT_TABLES.map((spec) => readTable(supabase, user.id, spec))
	);
	const tables: AccountExport["tables"] = {};
	const unavailable: string[] = [];
	for (const result of results) {
		if (result.rows) tables[result.table] = result.rows;
		else unavailable.push(result.table);
	}
	return {
		exported_at: new Date().toISOString(),
		format_version: 1,
		account: { id: user.id, email: user.email ?? null },
		tables,
		unavailable,
	};
}

// ==================== Deletion ====================

async function deleteKeys(client: S3Client, bucket: string, keys: readonly string[]) {
	const batches = chunk(keys, R2_DELETE_BATCH_SIZE);
	const results = await Promise.all(
		batches.map((batch) =>
			client.send(
				new DeleteObjectsCommand({
					Bucket: bucket,
					Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
				})
			)
		)
	);
	const failed = results.flatMap((result) => result.Errors ?? []);
	if (failed.length > 0) {
		throw new Error(`R2 refused to delete ${failed.length} object(s)`);
	}
}

/** Lists one page under the prefix, deletes it in one batch, then follows the cursor. */
async function purgePrefixPage(
	client: S3Client,
	bucket: string,
	prefix: string,
	continuationToken?: string
): Promise<number> {
	const page = await client.send(
		new ListObjectsV2Command({
			Bucket: bucket,
			Prefix: prefix,
			ContinuationToken: continuationToken,
			MaxKeys: R2_DELETE_BATCH_SIZE,
		})
	);
	const keys = (page.Contents ?? [])
		.map((object) => object.Key)
		.filter((key): key is string => typeof key === "string" && key.startsWith(prefix));
	if (keys.length > 0) await deleteKeys(client, bucket, keys);
	if (!page.IsTruncated || !page.NextContinuationToken) return keys.length;
	return keys.length + (await purgePrefixPage(client, bucket, prefix, page.NextContinuationToken));
}

/** Deletes every stored file for the user. Returns the number of objects removed. */
export async function deleteUserFiles(userId: string): Promise<number> {
	const client = getR2Client();
	const bucket = getR2Config()?.bucket;
	if (!client || !bucket) return 0;
	return purgePrefixPage(client, bucket, userStoragePrefix(userId));
}

export type DeleteAccountResult =
	| { ok: true; filesDeleted: number }
	| { ok: false; stage: "files" | "auth"; message: string };

/**
 * Permanently deletes a user: stored files first (so nothing is orphaned if this
 * fails), then the auth user. Every user table references profiles, which references
 * auth.users with ON DELETE CASCADE, so the database rows go with it. Same steps as
 * the admin delete in app/api/admin/users/delete, plus the file cleanup.
 */
export async function deleteUserAccount(userId: string): Promise<DeleteAccountResult> {
	let filesDeleted: number;
	try {
		filesDeleted = await deleteUserFiles(userId);
	} catch (error) {
		console.error("[account/delete] file cleanup failed:", error);
		return { ok: false, stage: "files", message: "We couldn't delete your stored files." };
	}

	const service = createServiceSupabase();
	const { error: authError } = await service.auth.admin.deleteUser(userId);
	if (authError) {
		console.error("[account/delete] auth delete failed:", authError);
		return { ok: false, stage: "auth", message: "We couldn't delete your account." };
	}

	// Best effort, in case the cascade from auth.users is missing on an old database.
	const { error: profileError } = await service.from("profiles").delete().eq("id", userId);
	if (profileError) console.error("[account/delete] profile cleanup:", profileError.message);

	return { ok: true, filesDeleted };
}
