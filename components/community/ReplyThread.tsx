"use client";

// Replies under a post, oldest first, with a reply box. Authors can delete their own
// replies; anyone can report one.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/app/blocks";
import { LocalDate } from "@/components/LocalDate";
import { createReply, deleteReply, errorMessage } from "@/lib/community/client";
import { COMMUNITY_LIMITS, type CommunityReply } from "@/lib/community/types";
import { ReportDialog } from "./ReportDialog";

function ReplyItem({ reply, onDeleted }: Readonly<{ reply: CommunityReply; onDeleted: () => void }>) {
	const [reporting, setReporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function remove() {
		setError(null);
		try {
			await deleteReply(reply.id);
			onDeleted();
		} catch (err) {
			setError(errorMessage(err, "Could not delete this reply"));
		}
	}

	return (
		<li className="border-b py-4 last:border-b-0">
			<article aria-label={`Reply from ${reply.author.displayName}`} className="space-y-2">
				<div className="flex items-start justify-between gap-3">
					<p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
						<span className="font-semibold text-foreground">{reply.author.displayName}</span>
						<span>
							· <LocalDate value={reply.createdAt} />
						</span>
						{reply.hidden && <Badge variant="destructive">Hidden by a moderator</Badge>}
					</p>
					{reply.isOwn ? (
						<Button type="button" variant="ghost" size="icon" aria-label="Delete your reply" onClick={() => void remove()}>
							<Trash2 className="h-4 w-4" aria-hidden="true" />
						</Button>
					) : (
						<Button type="button" variant="ghost" size="icon" aria-label="Report this reply" onClick={() => setReporting(true)}>
							<Flag className="h-4 w-4" aria-hidden="true" />
						</Button>
					)}
				</div>
				<p className="whitespace-pre-line text-[15px] leading-6">{reply.body}</p>
				{error && <output className="block text-sm text-[var(--danger)]">{error}</output>}
			</article>
			<ReportDialog open={reporting} onOpenChange={setReporting} targetType="reply" targetId={reply.id} />
		</li>
	);
}

function ReplyForm({ postId, onPosted }: Readonly<{ postId: string; onPosted: () => void }>) {
	const [body, setBody] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await createReply(postId, body.trim());
			setBody("");
			onPosted();
		} catch (err) {
			setError(errorMessage(err, "Could not post your reply"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={(event) => void submit(event)} className="space-y-3">
			<Label htmlFor="reply-body">Your reply</Label>
			<Textarea
				id="reply-body"
				required
				maxLength={COMMUNITY_LIMITS.replyLength}
				placeholder="Share what worked for you. Be kind and specific."
				value={body}
				onChange={(event) => setBody(event.target.value)}
			/>
			<div className="flex items-center gap-3">
				<Button type="submit" variant="cap" disabled={busy}>
					{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					Reply
				</Button>
				{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
			</div>
		</form>
	);
}

export function ReplyThread({ postId, replies }: Readonly<{ postId: string; replies: CommunityReply[] }>) {
	const router = useRouter();
	const refresh = () => router.refresh();
	return (
		<section aria-labelledby="replies-heading" className="space-y-4">
			<SectionHeader title={<span id="replies-heading">Replies</span>} />
			{replies.length === 0 ? (
				<p className="text-sm text-muted-foreground">No replies yet. Be the first to help.</p>
			) : (
				<ul>
					{replies.map((reply) => (
						<ReplyItem key={reply.id} reply={reply} onDeleted={refresh} />
					))}
				</ul>
			)}
			<ReplyForm postId={postId} onPosted={refresh} />
		</section>
	);
}
