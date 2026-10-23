import "server-only";

/**
 * Fetches a page's <title> for the learning log, SSRF-safe:
 * - http/https only, standard ports, no credentials, no localhost-style names (urlSafety.ts)
 * - every DNS answer is checked inside the socket's own lookup, so a rebinding answer
 *   can't slip in between the check and the connection
 * - redirects are followed by hand (at most 3), each one re-checked
 * - 5 s overall timeout and a 256 KB read cap
 */
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { checkFetchableUrl, extractTitle, isPrivateAddress } from "./urlSafety";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 256 * 1024;
const MAX_REDIRECTS = 3;

class BlockedAddressError extends Error {
	code = "EBLOCKED";
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
	dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
		if (error) {
			callback(error, "", 0);
			return;
		}
		const list = addresses as LookupAddress[];
		if (list.length === 0 || list.some((entry) => isPrivateAddress(entry.address))) {
			callback(new BlockedAddressError(`Blocked non-public address for ${hostname}`), "", 0);
			return;
		}
		if (options.all) {
			(callback as unknown as (err: null, addrs: LookupAddress[]) => void)(null, list);
			return;
		}
		callback(null, list[0].address, list[0].family);
	});
};

type PageResponse = { status: number; location: string | null; body: string; contentType: string };

function requestOnce(url: URL, signal: AbortSignal): Promise<PageResponse> {
	const client = url.protocol === "https:" ? https : http;
	return new Promise((resolve, reject) => {
		const req = client.get(
			url,
			{
				lookup: safeLookup,
				signal,
				headers: {
					"User-Agent": "NextMilestoneBot/1.0 (+link preview)",
					Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
				},
			},
			(res) => {
				const status = res.statusCode ?? 0;
				const contentType = String(res.headers["content-type"] ?? "");
				const location = typeof res.headers.location === "string" ? res.headers.location : null;
				if (status >= 300 || !contentType.toLowerCase().includes("html")) {
					res.resume();
					resolve({ status, location, body: "", contentType });
					return;
				}
				const chunks: Buffer[] = [];
				let size = 0;
				res.on("data", (chunk: Buffer) => {
					chunks.push(chunk);
					size += chunk.length;
					// Titles live in <head>: stop once the cap is reached or the head has closed.
					if (size >= MAX_BYTES || chunk.includes("</title")) res.destroy();
				});
				const finish = () => resolve({ status, location, body: Buffer.concat(chunks).subarray(0, MAX_BYTES).toString("utf8"), contentType });
				res.on("end", finish);
				res.on("close", finish);
				res.on("error", finish);
			}
		);
		req.on("error", reject);
	});
}

function isRedirect(status: number) {
	return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function followRedirects(start: URL, signal: AbortSignal): Promise<string | null> {
	let current = start;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		// Each hop depends on the previous response, so the requests are sequential by design.
		// eslint-disable-next-line no-await-in-loop
		const page = await requestOnce(current, signal);
		if (!isRedirect(page.status)) return page.status === 200 ? extractTitle(page.body) : null;
		if (!page.location) return null;
		const check = checkFetchableUrl(new URL(page.location, current).toString());
		if (!check.ok) return null;
		current = check.url;
	}
	return null;
}

/** The page title, or null when the link is blocked, slow, not HTML or has no title. Never throws. */
export async function fetchPageTitle(raw: string): Promise<string | null> {
	const check = checkFetchableUrl(raw);
	if (!check.ok) return null;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await followRedirects(check.url, controller.signal);
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}
