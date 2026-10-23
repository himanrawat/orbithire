"use client";

// One community post: type, topic, author, body, and the member actions (Helpful, save,
// follow, mute, block, report, delete). The Helpful count shows here, on the post, never
// on a profile.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ExternalLink, Flag, MessageCircle, MoreHorizontal, ThumbsUp, Trash2, UserMinus, UserPlus, VolumeX, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocalDate } from "@/components/LocalDate";
import { cn } from "@/lib/utils";
import { deletePost, errorMessage, togglePost, updateRelation } from "@/lib/community/client";
import { POST_TYPE_LABELS, TOPIC_LABELS, type CommunityPost, type PostType, type RelationAction } from "@/lib/community/types";
import { ReportDialog } from "./ReportDialog";

const TYPE_VARIANT: Readonly<Record<PostType, "focus" | "learn" | "prep" | "jobs">> = {
	milestone: "focus",
	learning: "learn",
	question: "prep",
	link: "jobs",
};

function AuthorLine({ post }: Readonly<{ post: CommunityPost }>) {
	return (
		<p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
			<span className="font-semibold text-foreground">{post.author.displayName}</span>
			{post.author.headline && <span className="truncate">· {post.author.headline}</span>}
			<span>
				· <LocalDate value={post.createdAt} />
			</span>
		</p>
	);
}

function PostLink({ url }: Readonly<{ url: string }>) {
	let host = url;
	try {
		host = new URL(url).hostname;
	} catch {
		// keep the raw URL as the label
	}
	return (
		<a
			href={url}
			target="_blank"
			rel="noopener noreferrer nofollow ugc"
			className="inline-flex items-center gap-1 text-sm font-medium text-[var(--info)] underline-offset-2 hover:underline"
		>
			<ExternalLink className="h-4 w-4" aria-hidden="true" />
			{host}
		</a>
	);
}

type MenuProps = Readonly<{
	post: CommunityPost;
	onRelation: (action: RelationAction) => void;
	onReport: () => void;
	onDelete: () => void;
}>;

function PostMenu({ post, onRelation, onReport, onDelete }: MenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="More actions for this post">
					<MoreHorizontal className="h-4 w-4" aria-hidden="true" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				{post.isOwn ? (
					<DropdownMenuItem onSelect={onDelete}>
						<Trash2 className="h-4 w-4" aria-hidden="true" />
						Delete post
					</DropdownMenuItem>
				) : (
					<OthersMenuItems post={post} onRelation={onRelation} onReport={onReport} />
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function OthersMenuItems({ post, onRelation, onReport }: Omit<MenuProps, "onDelete">) {
	const name = post.author.displayName;
	return (
		<>
			{post.followingAuthor ? (
				<DropdownMenuItem onSelect={() => onRelation("unfollow")}>
					<UserMinus className="h-4 w-4" aria-hidden="true" />
					Unfollow {name}
				</DropdownMenuItem>
			) : (
				<DropdownMenuItem onSelect={() => onRelation("follow")}>
					<UserPlus className="h-4 w-4" aria-hidden="true" />
					Follow {name}
				</DropdownMenuItem>
			)}
			<DropdownMenuItem onSelect={() => onRelation("mute")}>
				<VolumeX className="h-4 w-4" aria-hidden="true" />
				Mute {name}
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => onRelation("block")}>
				<Ban className="h-4 w-4" aria-hidden="true" />
				Block {name}
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={onReport}>
				<Flag className="h-4 w-4" aria-hidden="true" />
				Report post
			</DropdownMenuItem>
		</>
	);
}

function usePostActions(post: CommunityPost) {
	const router = useRouter();
	const [helpful, setHelpful] = useState(post.markedHelpful);
	const [helpfulCount, setHelpfulCount] = useState(post.helpfulCount);
	const [saved, setSaved] = useState(post.saved);
	const [error, setError] = useState<string | null>(null);

	async function run(action: () => Promise<void>, fallback: string) {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(errorMessage(err, fallback));
		}
	}

	const toggleHelpful = () =>
		run(async () => {
			const result = await togglePost(post.id, "helpful", !helpful);
			setHelpful(result.on);
			setHelpfulCount(result.helpfulCount ?? helpfulCount);
		}, "Could not update this post");
	const toggleSave = () =>
		run(async () => {
			setSaved((await togglePost(post.id, "save", !saved)).on);
		}, "Could not save this post");
	const relation = (action: RelationAction) =>
		run(async () => {
			await updateRelation(action, post.author.id);
			router.refresh();
		}, "Could not update this member");
	const remove = () =>
		run(async () => {
			await deletePost(post.id);
			router.refresh();
		}, "Could not delete this post");

	return { helpful, helpfulCount, saved, error, toggleHelpful, toggleSave, relation, remove };
}

export function PostCard({ post, detail = false }: Readonly<{ post: CommunityPost; detail?: boolean }>) {
	const actions = usePostActions(post);
	const [reporting, setReporting] = useState(false);
	const href = `/feed/${post.id}`;

	return (
		<Card>
			<CardContent className="p-5">
				<article aria-labelledby={`post-title-${post.id}`} className="space-y-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0 space-y-1">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant={TYPE_VARIANT[post.type]}>{POST_TYPE_LABELS[post.type]}</Badge>
								<Link href={`/feed?topic=${post.topic}`} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
									{TOPIC_LABELS[post.topic]}
								</Link>
								{post.hidden && <Badge variant="destructive">Hidden by a moderator</Badge>}
							</div>
							<AuthorLine post={post} />
						</div>
						<PostMenu
							post={post}
							onRelation={(action) => void actions.relation(action)}
							onReport={() => setReporting(true)}
							onDelete={() => void actions.remove()}
						/>
					</div>
					<h3 id={`post-title-${post.id}`} className="font-display text-lg font-[650] leading-6">
						{detail ? post.title : <Link href={href} className="hover:underline">{post.title}</Link>}
					</h3>
					{post.body && (
						<p className={cn("whitespace-pre-line text-[15px] leading-6", !detail && "line-clamp-4")}>{post.body}</p>
					)}
					{post.url && <PostLink url={post.url} />}
					<div className="flex flex-wrap items-center gap-2 pt-1">
						<Button
							type="button"
							variant={actions.helpful ? "secondary" : "ghost"}
							size="sm"
							aria-pressed={actions.helpful}
							onClick={() => void actions.toggleHelpful()}
						>
							<ThumbsUp className="h-4 w-4" aria-hidden="true" />
							Helpful
							<span className="font-mono tabular-nums">{actions.helpfulCount}</span>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<Link href={href}>
								<MessageCircle className="h-4 w-4" aria-hidden="true" />
								Replies <span className="font-mono tabular-nums">{post.replyCount}</span>
							</Link>
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							aria-pressed={actions.saved}
							onClick={() => void actions.toggleSave()}
						>
							<Bookmark className={cn("h-4 w-4", actions.saved && "fill-current")} aria-hidden="true" />
							{actions.saved ? "Saved" : "Save"}
						</Button>
						{actions.error && <output className="text-sm text-[var(--danger)]">{actions.error}</output>}
					</div>
				</article>
				<ReportDialog open={reporting} onOpenChange={setReporting} targetType="post" targetId={post.id} />
			</CardContent>
		</Card>
	);
}
