/**
 * A tiny, safe Markdown subset for lesson and guide bodies, parsed into a plain tree that
 * components/learn/Markdown.tsx renders as React elements (never raw HTML).
 *
 * Blocks: # and ## headings (rendered as h2, under the page h1), ### (h3), paragraphs, "-" / "*" lists, "1." lists, > quotes and
 * ``` fenced code. Inline: `code`, **bold**, _italic_ / *italic* and [text](https://link).
 * Links are kept only for http(s) URLs and site-relative paths; anything else stays text.
 * Parsing is linear string scanning, no backtracking regexes.
 */

export type Inline =
	| { type: "text"; text: string }
	| { type: "code"; text: string }
	| { type: "strong"; children: Inline[] }
	| { type: "em"; children: Inline[] }
	| { type: "link"; href: string; children: Inline[] };

export type Block =
	| { type: "heading"; level: 2 | 3; children: Inline[] }
	| { type: "paragraph"; children: Inline[] }
	| { type: "list"; ordered: boolean; items: Inline[][] }
	| { type: "quote"; children: Inline[] }
	| { type: "code"; text: string };

export function safeHref(raw: string): string | null {
	const href = raw.trim();
	if (href.startsWith("/") && !href.startsWith("//")) return href;
	try {
		const url = new URL(href);
		return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
	} catch {
		return null;
	}
}

function pushText(out: Inline[], text: string) {
	if (!text) return;
	const last = out.at(-1);
	if (last?.type === "text") last.text += text;
	else out.push({ type: "text", text });
}

type Match = { node: Inline; end: number };

function matchCode(text: string, i: number): Match | null {
	const close = text.indexOf("`", i + 1);
	if (close <= i + 1) return null;
	return { node: { type: "code", text: text.slice(i + 1, close) }, end: close + 1 };
}

function matchStrong(text: string, i: number, depth: number): Match | null {
	if (text[i + 1] !== "*") return null;
	const close = text.indexOf("**", i + 2);
	if (close <= i + 2) return null;
	return { node: { type: "strong", children: parseInline(text.slice(i + 2, close), depth + 1) }, end: close + 2 };
}

function matchEm(text: string, i: number, depth: number): Match | null {
	const marker = text[i];
	const prev = i > 0 ? text[i - 1] : " ";
	// Only open after a space or punctuation, so snake_case and 2*3 stay literal.
	if (/[A-Za-z0-9]/.test(prev)) return null;
	const close = text.indexOf(marker, i + 1);
	if (close <= i + 1 || text[i + 1] === " ") return null;
	const after = text[close + 1] ?? " ";
	if (/[A-Za-z0-9]/.test(after)) return null;
	return { node: { type: "em", children: parseInline(text.slice(i + 1, close), depth + 1) }, end: close + 1 };
}

function matchLink(text: string, i: number, depth: number): Match | null {
	const closeLabel = text.indexOf("](", i + 1);
	if (closeLabel === -1) return null;
	const closeUrl = text.indexOf(")", closeLabel + 2);
	if (closeUrl === -1) return null;
	const label = text.slice(i + 1, closeLabel);
	if (label.includes("[")) return null;
	const href = safeHref(text.slice(closeLabel + 2, closeUrl));
	const children = parseInline(label, depth + 1);
	if (!href) return { node: { type: "text", text: label }, end: closeUrl + 1 };
	return { node: { type: "link", href, children }, end: closeUrl + 1 };
}

function matchAt(text: string, i: number, depth: number): Match | null {
	const ch = text[i];
	if (ch === "`") return matchCode(text, i);
	if (depth > 3) return null;
	if (ch === "[") return matchLink(text, i, depth);
	if (ch === "*") return matchStrong(text, i, depth) ?? matchEm(text, i, depth);
	if (ch === "_") return matchEm(text, i, depth);
	return null;
}

export function parseInline(text: string, depth = 0): Inline[] {
	const out: Inline[] = [];
	let plainStart = 0;
	let i = 0;
	while (i < text.length) {
		const match = "`[*_".includes(text[i]) ? matchAt(text, i, depth) : null;
		if (match) {
			pushText(out, text.slice(plainStart, i));
			if (match.node.type === "text") pushText(out, match.node.text);
			else out.push(match.node);
			i = match.end;
			plainStart = i;
		} else {
			i++;
		}
	}
	pushText(out, text.slice(plainStart));
	return out;
}

function headingOf(line: string): Block | null {
	let level = 0;
	while (level < line.length && line[level] === "#") level++;
	if (level < 1 || level > 3 || line[level] !== " ") return null;
	return { type: "heading", level: level === 3 ? 3 : 2, children: parseInline(line.slice(level + 1).trim()) };
}

function bulletText(line: string): string | null {
	if ((line.startsWith("- ") || line.startsWith("* ")) && line.length > 2) return line.slice(2).trim();
	return null;
}

function orderedText(line: string): string | null {
	let i = 0;
	while (i < line.length && i < 3 && line[i] >= "0" && line[i] <= "9") i++;
	if (i === 0 || line[i] !== "." || line[i + 1] !== " ") return null;
	return line.slice(i + 2).trim();
}

type Cursor = { lines: string[]; i: number };

function readCode(cursor: Cursor): Block {
	const body: string[] = [];
	cursor.i++;
	while (cursor.i < cursor.lines.length && !cursor.lines[cursor.i].trimStart().startsWith("```")) {
		body.push(cursor.lines[cursor.i]);
		cursor.i++;
	}
	cursor.i++;
	return { type: "code", text: body.join("\n") };
}

function readList(cursor: Cursor, pick: (line: string) => string | null, ordered: boolean): Block {
	const items: Inline[][] = [];
	while (cursor.i < cursor.lines.length) {
		const text = pick(cursor.lines[cursor.i].trim());
		if (text === null) break;
		items.push(parseInline(text));
		cursor.i++;
	}
	return { type: "list", ordered, items };
}

function readRun(cursor: Cursor, accept: (line: string) => string | null): string {
	const parts: string[] = [];
	while (cursor.i < cursor.lines.length) {
		const text = accept(cursor.lines[cursor.i].trim());
		if (text === null) break;
		parts.push(text);
		cursor.i++;
	}
	return parts.join(" ");
}

function quoteText(line: string): string | null {
	return line.startsWith(">") ? line.slice(1).trim() : null;
}

function startsBlock(line: string) {
	return (
		line === "" ||
		line.startsWith("```") ||
		line.startsWith(">") ||
		headingOf(line) !== null ||
		bulletText(line) !== null ||
		orderedText(line) !== null
	);
}

function paragraphText(line: string): string | null {
	return startsBlock(line) ? null : line;
}

function readBlock(cursor: Cursor): Block | null {
	const line = cursor.lines[cursor.i].trim();
	if (line === "") {
		cursor.i++;
		return null;
	}
	if (line.startsWith("```")) return readCode(cursor);
	const heading = headingOf(line);
	if (heading) {
		cursor.i++;
		return heading;
	}
	if (bulletText(line) !== null) return readList(cursor, bulletText, false);
	if (orderedText(line) !== null) return readList(cursor, orderedText, true);
	if (line.startsWith(">")) return { type: "quote", children: parseInline(readRun(cursor, quoteText)) };
	cursor.i++;
	const rest = readRun(cursor, paragraphText);
	return { type: "paragraph", children: parseInline(rest ? `${line} ${rest}` : line) };
}

export function parseMarkdown(source: string): Block[] {
	const cursor: Cursor = { lines: source.replaceAll("\r\n", "\n").split("\n"), i: 0 };
	const blocks: Block[] = [];
	while (cursor.i < cursor.lines.length) {
		const block = readBlock(cursor);
		if (block) blocks.push(block);
	}
	return blocks;
}
