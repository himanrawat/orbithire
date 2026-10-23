import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RecordView } from "@/components/community/RecordView";
import { PostCard } from "@/components/community/PostCard";
import { ReplyThread } from "@/components/community/ReplyThread";
import { idSchema } from "@/lib/community/schema";
import { loadGate, loadThreadPage, requirePageUser } from "../data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Community post" };

export default async function PostPage({ params }: Readonly<{ params: { id: string } }>) {
	if (!idSchema.safeParse(params.id).success) notFound();
	const user = await requirePageUser(`/feed/${params.id}`);
	const gate = await loadGate(user);
	if (gate.state !== "member") redirect("/feed");

	const thread = await loadThreadPage(user, params.id);
	if (!thread) notFound();

	return (
		<div className="mx-auto w-full max-w-3xl space-y-6">
			<PageHeader title="Post" back={{ href: "/feed", label: "Community" }} className="mb-0" />
			<RecordView postId={thread.post.id} skip={thread.post.isOwn} />
			<PostCard post={thread.post} detail />
			<Card>
				<CardContent className="p-5">
					<ReplyThread postId={thread.post.id} replies={thread.replies} />
				</CardContent>
			</Card>
		</div>
	);
}
