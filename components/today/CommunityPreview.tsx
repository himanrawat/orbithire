import Link from "next/link";
import { Users } from "lucide-react";
import { POST_TYPE_LABELS, type PostType } from "@/lib/community/types";
import type { TodayPost } from "@/lib/today/types";

function typeLabel(type: string): string {
	return POST_TYPE_LABELS[type as PostType] ?? type;
}

function Placeholder({ title, body, action, href }: Readonly<{ title: string; body: string; action: string; href: string }>) {
	return (
		<div className="flex items-start gap-4 rounded-[var(--radius-md)] border border-dashed bg-card p-5">
			<Users className="mt-0.5 h-5 w-5 flex-none text-muted-foreground" aria-hidden="true" />
			<div className="space-y-1">
				<p className="font-medium">{title}</p>
				<p className="text-sm text-muted-foreground">{body}</p>
				<Link href={href} className="inline-block pt-1 text-sm font-medium text-[var(--info)] underline-offset-2 hover:underline">
					{action}
				</Link>
			</div>
		</div>
	);
}

/**
 * Three posts from the For you feed, below the day's actions. `posts` is null when the
 * person isn't a community member yet; both empty cases show a placeholder.
 */
export function CommunityPreview({ posts }: Readonly<{ posts: readonly TodayPost[] | null }>) {
	return (
		<section aria-labelledby="feed-preview-heading" className="space-y-3 pt-2">
			<div className="flex items-baseline justify-between gap-3 border-b pb-2">
				<h2 id="feed-preview-heading" className="text-[15px] font-semibold">
					From the community
				</h2>
				{posts && (
					<Link href="/feed" className="text-sm font-medium text-[var(--info)] underline-offset-2 hover:underline">
						Open feed
					</Link>
				)}
			</div>
			{posts === null && (
				<Placeholder
					title="Learn from people a few steps ahead"
					body="Share what you're learning and read what worked for others in your field. Community is invite-only while it opens."
					action="Request an invite"
					href="/feed"
				/>
			)}
			{posts?.length === 0 && (
				<Placeholder
					title="No posts yet"
					body="Be the first this week: share something you learned, a milestone or a question."
					action="Write a post"
					href="/feed"
				/>
			)}
			{posts && posts.length > 0 && (
				<ul className="divide-y">
					{posts.map((post) => (
						<li key={post.id}>
							<Link href={`/feed/${post.id}`} className="block py-3 hover:bg-muted/40">
								<span className="block text-[13px] text-muted-foreground">
									<span className="font-semibold text-foreground">{post.authorName}</span> · {typeLabel(post.type)}
								</span>
								<span className="mt-1 block font-medium leading-6">{post.title}</span>
								<span className="mt-1 block text-[13px] text-muted-foreground">
									{post.helpfulCount} found this helpful · {post.replyCount} {post.replyCount === 1 ? "reply" : "replies"}
								</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
