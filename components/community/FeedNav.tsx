// Feed switcher: For you, Following, Saved, Your posts, and one feed per topic. Links, so
// each feed is shareable and works without JavaScript.

import Link from "next/link";
import { cn } from "@/lib/utils";
import { tabClass, tabListClass } from "@/components/app/blocks";
import { FEED_KINDS, FEED_LABELS, feedHref, type FeedSelection } from "@/lib/community/feeds";
import { TOPIC_LABELS, TOPICS } from "@/lib/community/types";

function isActive(current: FeedSelection, candidate: FeedSelection) {
	return current.kind === candidate.kind && current.topic === candidate.topic;
}

function topicClass(active: boolean) {
	return cn(
		"inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors",
		active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
	);
}

export function FeedNav({ current }: Readonly<{ current: FeedSelection }>) {
	return (
		<nav aria-label="Feeds" className="space-y-3">
			<ul className={cn(tabListClass, "w-fit")}>
				{FEED_KINDS.map((kind) => {
					const selection: FeedSelection = { kind, topic: null };
					const active = isActive(current, selection);
					return (
						<li key={kind}>
							<Link href={feedHref(selection)} className={tabClass(active)} aria-current={active ? "page" : undefined}>
								{FEED_LABELS[kind]}
							</Link>
						</li>
					);
				})}
			</ul>
			<ul className="flex flex-wrap gap-2" aria-label="Topics">
				{TOPICS.map((topic) => {
					const active = current.kind === "topic" && current.topic === topic;
					return (
						<li key={topic}>
							<Link href={feedHref({ kind: "topic", topic })} className={topicClass(active)} aria-current={active ? "page" : undefined}>
								{TOPIC_LABELS[topic]}
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}
