/**
 * Pure SSRF guards and HTML title extraction for the learning log's link preview.
 * The network side lives in lib/learn/fetchTitle.ts. No server imports, so tests can use it.
 */
import { isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan"];

function isPrivateIpv4(ip: string): boolean {
	const [a, b] = ip.split(".").map(Number);
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 192 && b === 0) ||
		(a === 198 && (b === 18 || b === 19)) ||
		a >= 224
	);
}

function isPrivateIpv6(ip: string): boolean {
	const x = ip.toLowerCase();
	if (x === "::" || x === "::1") return true;
	if (x.startsWith("::ffff:")) {
		const tail = x.slice(7);
		return isIP(tail) === 4 ? isPrivateIpv4(tail) : true;
	}
	if (x.startsWith("64:ff9b:")) return true; // NAT64 can reach IPv4 space
	const first = x.split(":")[0] ?? "";
	return (
		first.startsWith("fc") ||
		first.startsWith("fd") ||
		first.startsWith("fe8") ||
		first.startsWith("fe9") ||
		first.startsWith("fea") ||
		first.startsWith("feb") ||
		first.startsWith("ff")
	);
}

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip: string): boolean {
	const version = isIP(ip);
	if (version === 4) return isPrivateIpv4(ip);
	if (version === 6) return isPrivateIpv6(ip);
	return true;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

function stripBrackets(hostname: string) {
	return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

export function hostOf(url: URL) {
	return stripBrackets(url.hostname).toLowerCase();
}

/**
 * Static checks before any network call: http(s) only, default-ish ports, no credentials,
 * no localhost-style names and no private IP literals. DNS answers are checked separately.
 */
export function checkFetchableUrl(raw: string): UrlCheck {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return { ok: false, reason: "Not a valid URL" };
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "Only http and https links" };
	if (url.username || url.password) return { ok: false, reason: "Links with credentials are not allowed" };
	if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "Only standard ports" };
	const host = hostOf(url);
	if (!host || host === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
		return { ok: false, reason: "Private hosts are not allowed" };
	}
	if (isIP(host) !== 0 && isPrivateAddress(host)) return { ok: false, reason: "Private addresses are not allowed" };
	if (isIP(host) === 0 && !host.includes(".")) return { ok: false, reason: "Private hosts are not allowed" };
	return { ok: true, url };
}

const ENTITIES: Readonly<Record<string, string>> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	"#39": "'",
	nbsp: " ",
	ndash: "–",
	mdash: "—",
	hellip: "…",
	rsquo: "’",
	lsquo: "‘",
	rdquo: "”",
	ldquo: "“",
};

function decodeEntity(name: string): string | null {
	const known = ENTITIES[name.toLowerCase()];
	if (known) return known;
	if (!name.startsWith("#")) return null;
	const hex = name[1] === "x" || name[1] === "X";
	const code = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
	if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null;
	return String.fromCodePoint(code);
}

/** Decodes the common named and numeric entities with a single linear scan. */
export function decodeEntities(text: string): string {
	let out = "";
	let i = 0;
	while (i < text.length) {
		const amp = text.indexOf("&", i);
		if (amp === -1) break;
		const semi = text.indexOf(";", amp);
		out += text.slice(i, amp);
		const decoded = semi !== -1 && semi - amp <= 10 ? decodeEntity(text.slice(amp + 1, semi)) : null;
		if (decoded === null) {
			out += "&";
			i = amp + 1;
		} else {
			out += decoded;
			i = semi + 1;
		}
	}
	return out + text.slice(i);
}

export function collapseWhitespace(text: string) {
	return text.split(/\s+/).filter(Boolean).join(" ");
}

/** The first <title> of an HTML document, decoded and trimmed, or null. String scanning only. */
export function extractTitle(html: string, maxLength = 300): string | null {
	const lower = html.toLowerCase();
	let from = 0;
	while (from < lower.length) {
		const open = lower.indexOf("<title", from);
		if (open === -1) return null;
		const next = lower[open + 6];
		if (next === ">" || next === " " || next === "\t" || next === "\n" || next === "\r") {
			const tagEnd = lower.indexOf(">", open);
			if (tagEnd === -1) return null;
			const close = lower.indexOf("</title", tagEnd);
			if (close === -1) return null;
			const title = collapseWhitespace(decodeEntities(html.slice(tagEnd + 1, close)));
			return title ? title.slice(0, maxLength) : null;
		}
		from = open + 6;
	}
	return null;
}

/** A readable fallback title: the host without "www." plus the first path segment. */
export function fallbackTitle(raw: string): string {
	try {
		const url = new URL(raw);
		const host = hostOf(url).replace(/^www\./, "");
		const segment = url.pathname.split("/").find(Boolean);
		return segment ? `${host}/${decodeURIComponent(segment)}`.slice(0, 300) : host;
	} catch {
		return raw.slice(0, 300);
	}
}
