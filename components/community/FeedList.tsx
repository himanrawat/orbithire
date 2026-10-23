"use client";

// The posts in a feed. Records one view per post per member once the list is shown,
// which feeds the helpful-per-view ranking.

import { useEffect } from "react";
import { EmptyState } from "@/components/app/blocks";
import { recordViews } from "@/lib/community/client";
import type { CommunityPost } from "@/lib/community/types";
import { PostCard } from "./PostCard";

type FeedListProps = Readonly<{
	posts: CommunityPost[];
	emptyTitle: string;
	emptyDescription: string;
}>;

export function FeedList({ posts, emptyTitle, emptyDescription }: FeedListProps) {
	const viewKey = posts
		.filter((post) => !post.isOwn)
		.map((post) => post.id)
		.join(",");

	useEffect(() => {
		if (viewKey) void recordViews(viewKey.split(","));
	}, [viewKey]);

	if (posts.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
	return (
		<ul className="space-y-4" aria-label="Posts">
			{posts.map((post) => (
				<li key={post.id}>
					<PostCard post={post} />
				</li>
			))}
		</ul>
	);
}
