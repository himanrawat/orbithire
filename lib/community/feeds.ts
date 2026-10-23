/** Feed selection from the URL (?feed=following, ?topic=interviews). Pure. */
import { isTopic, TOPIC_LABELS, type Topic } from "./types";

export const FEED_KINDS = ["for-you", "following", "saved", "mine"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export type FeedSelection =
	| Readonly<{ kind: FeedKind; topic: null }>
	| Readonly<{ kind: "topic"; topic: Topic }>;

export const FEED_LABELS: Readonly<Record<FeedKind, string>> = {
	"for-you": "For you",
	following: "Following",
	saved: "Saved",
	mine: "Your posts",
};

type SearchValue = string | string[] | undefined;

function first(value: SearchValue) {
	return Array.isArray(value) ? value[0] : value;
}

export function parseFeed(params: Readonly<{ feed?: SearchValue; topic?: SearchValue }>): FeedSelection {
	const topic = first(params.topic);
	if (isTopic(topic)) return { kind: "topic", topic };
	const feed = first(params.feed);
	if (feed && (FEED_KINDS as readonly string[]).includes(feed)) return { kind: feed as FeedKind, topic: null };
	return { kind: "for-you", topic: null };
}

export function feedHref(selection: FeedSelection) {
	if (selection.kind === "topic") return `/feed?topic=${selection.topic}`;
	if (selection.kind === "for-you") return "/feed";
	return `/feed?feed=${selection.kind}`;
}

export function feedTitle(selection: FeedSelection) {
	return selection.kind === "topic" ? TOPIC_LABELS[selection.topic] : FEED_LABELS[selection.kind];
}

const EMPTY_COPY: Readonly<Record<FeedKind | "topic", { title: string; description: string }>> = {
	"for-you": {
		title: "Nothing here yet",
		description: "Be the first to share a milestone, something you learned or a question.",
	},
	following: {
		title: "No posts from people you follow",
		description: "Follow members from their posts or from People a few steps ahead.",
	},
	saved: { title: "No saved posts", description: "Save a post to come back to it later." },
	mine: { title: "You haven't posted yet", description: "Share a milestone or ask a question to get started." },
	topic: { title: "No posts in this topic yet", description: "Start the conversation with a post." },
};

export function feedEmptyCopy(selection: FeedSelection) {
	return EMPTY_COPY[selection.kind];
}
