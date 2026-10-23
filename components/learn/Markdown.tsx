// Renders the safe Markdown subset from lib/learn/markdown.ts as React elements. No raw
// HTML is ever injected: text is escaped by React and links are limited to http(s) and
// site-relative paths.

import Link from "next/link";
import type { ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/learn/markdown";
import { cn } from "@/lib/utils";

const linkClass = "font-medium text-[var(--info)] underline underline-offset-2 hover:decoration-2";

function InlineLink({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
	if (href.startsWith("/")) {
		return (
			<Link href={href} className={linkClass}>
				{children}
			</Link>
		);
	}
	return (
		<a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
			{children}
			<span className="sr-only"> (opens in a new tab)</span>
		</a>
	);
}

function renderInline(nodes: readonly Inline[]): ReactNode[] {
	return nodes.map((node, index) => {
		const key = `${node.type}-${index}`;
		switch (node.type) {
			case "text":
				return node.text;
			case "code":
				return (
					<code key={key} className="rounded-[4px] bg-secondary px-1 py-0.5 font-mono text-[0.9em]">
						{node.text}
					</code>
				);
			case "strong":
				return <strong key={key}>{renderInline(node.children)}</strong>;
			case "em":
				return <em key={key}>{renderInline(node.children)}</em>;
			case "link":
				return (
					<InlineLink key={key} href={node.href}>
						{renderInline(node.children)}
					</InlineLink>
				);
		}
	});
}

const HEADING_CLASS = {
	2: "mt-8 font-display text-xl font-[650] leading-7 tracking-[-0.015em]",
	3: "mt-7 font-display text-lg font-[650] leading-6 tracking-[-0.01em]",
} as const;

function Heading({ block }: Readonly<{ block: Extract<Block, { type: "heading" }> }>) {
	const children = renderInline(block.children);
	if (block.level === 2) return <h2 className={HEADING_CLASS[2]}>{children}</h2>;
	return <h3 className={HEADING_CLASS[3]}>{children}</h3>;
}

function ListBlock({ block }: Readonly<{ block: Extract<Block, { type: "list" }> }>) {
	const items = block.items.map((item, index) => (
		<li key={`li-${index}`} className="pl-1">
			{renderInline(item)}
		</li>
	));
	if (block.ordered) return <ol className="mt-3 list-decimal space-y-1.5 pl-6">{items}</ol>;
	return <ul className="mt-3 list-disc space-y-1.5 pl-6">{items}</ul>;
}

function BlockView({ block }: Readonly<{ block: Block }>) {
	switch (block.type) {
		case "heading":
			return <Heading block={block} />;
		case "paragraph":
			return <p className="mt-3">{renderInline(block.children)}</p>;
		case "list":
			return <ListBlock block={block} />;
		case "quote":
			return (
				<blockquote className="mt-4 border-l-2 border-border pl-4 text-muted-foreground">
					{renderInline(block.children)}
				</blockquote>
			);
		case "code":
			return (
				<pre className="mt-4 overflow-x-auto rounded-[var(--radius-sm)] bg-secondary p-4 font-mono text-[13px] leading-5">
					<code>{block.text}</code>
				</pre>
			);
	}
}

export function Markdown({ source, className }: Readonly<{ source: string; className?: string }>) {
	const blocks = parseMarkdown(source);
	return (
		<div className={cn("text-[15px] leading-[24px] text-foreground [&>*:first-child]:mt-0", className)}>
			{blocks.map((block, index) => (
				<BlockView key={`${block.type}-${index}`} block={block} />
			))}
		</div>
	);
}
