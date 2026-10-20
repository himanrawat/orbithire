/**
 * Minimal RFC 4180 CSV parser (quoted fields, "" escapes, CRLF/LF, embedded newlines).
 * Kept dependency-free so it runs in route handlers and in the test script.
 * Mirrored by Python's csv module in worker/orbithire_worker/import_legacy.py.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;
	const src = text.replace(/^﻿/, "");
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (inQuotes) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
			continue;
		}
		if (c === '"') {
			inQuotes = true;
		} else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && src[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += c;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	// drop fully blank lines
	return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** Parse CSV text into objects keyed by the (lower-cased, trimmed) header row. */
export function parseCsvObjects(text: string): Record<string, string>[] {
	const rows = parseCsv(text);
	if (rows.length === 0) return [];
	const header = rows[0].map((h) => h.trim().toLowerCase());
	return rows.slice(1).map((r) => {
		const obj: Record<string, string> = {};
		header.forEach((h, i) => {
			if (h) obj[h] = (r[i] ?? "").trim();
		});
		return obj;
	});
}
