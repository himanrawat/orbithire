import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FeedList } from "@/components/community/FeedList";
import { FeedNav } from "@/components/community/FeedNav";
import { JoinCommunity } from "@/components/community/JoinCommunity";
import { PeopleAhead } from "@/components/community/PeopleAhead";
import { PostComposer } from "@/components/community/PostComposer";
import { feedEmptyCopy, feedTitle, parseFeed, type FeedSelection } from "@/lib/community/feeds";
import { loadFeedPage, loadGate, requirePageUser, type PageUser } from "./data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Community" };

type SearchParams = Record<string, string | string[] | undefined>;

function Notice({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<output className="mb-6 block rounded-[var(--radius-md)] border bg-card p-4 text-sm text-muted-foreground">
			{children}
		</output>
	);
}

async function MemberFeed({ user, selection }: Readonly<{ user: PageUser; selection: FeedSelection }>) {
	const data = await loadFeedPage(user, selection);
	const empty = feedEmptyCopy(selection);
	return (
		<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
			<div className="min-w-0 space-y-6">
				<PostComposer />
				<FeedNav current={selection} />
				<h2 className="sr-only">{feedTitle(selection)}</h2>
				{data.failed && <Notice>We couldn&apos;t load this feed. Please try again in a moment.</Notice>}
				<FeedList posts={data.posts} emptyTitle={empty.title} emptyDescription={empty.description} />
			</div>
			<aside aria-label="Suggestions">
				<PeopleAhead people={data.people} />
			</aside>
		</div>
	);
}

export default async function FeedPage({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
	const user = await requirePageUser();
	const gate = await loadGate(user);

	return (
		<div className="mx-auto w-full max-w-6xl">
			<PageHeader
				icon={<Users />}
				title="Community"
				description="Milestones, lessons and questions from people a few steps ahead. No like counts, no follower counts."
			/>
			{gate.state === "unavailable" && <Notice>Community isn&apos;t set up on this server yet. Please check back soon.</Notice>}
			{gate.state === "outside" && (
				<JoinCommunity launchField={gate.launchField} suspended={gate.suspended} alreadyRequested={gate.requested} />
			)}
			{gate.state === "member" && <MemberFeed user={user} selection={parseFeed(searchParams)} />}
		</div>
	);
}
