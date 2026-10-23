import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LessonActions } from "@/components/learn/LessonActions";
import { PathLockedNotice } from "@/components/learn/PathLockedNotice";
import { Markdown } from "@/components/learn/Markdown";
import { loadLesson } from "@/lib/learn/server";
import { lessonHref } from "@/lib/learn/types";
import { isPathLocked, requirePageUser } from "../../../data";

export const dynamic = "force-dynamic";

type Neighbor = Readonly<{ slug: string; title: string }> | null;

const navClass =
	"flex min-h-11 items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function LessonNav({ pathSlug, previous, next }: Readonly<{ pathSlug: string; previous: Neighbor; next: Neighbor }>) {
	return (
		<nav aria-label="Lessons in this path" className="mt-6 flex items-center justify-between gap-4">
			{previous ? (
				<Link href={lessonHref(pathSlug, previous.slug)} className={navClass}>
					<ChevronLeft className="h-4 w-4" aria-hidden="true" />
					<span>Previous: {previous.title}</span>
				</Link>
			) : (
				<span />
			)}
			{next && (
				<Link href={lessonHref(pathSlug, next.slug)} className={`${navClass} text-right`}>
					<span>Next: {next.title}</span>
					<ChevronRight className="h-4 w-4" aria-hidden="true" />
				</Link>
			)}
		</nav>
	);
}

export default async function LessonPage({ params }: Readonly<{ params: { slug: string; lesson: string } }>) {
	const { supabase, userId } = await requirePageUser();
	const lesson = await loadLesson(supabase, userId, params.slug, params.lesson).catch(() => null);
	if (!lesson) notFound();
	if (await isPathLocked(supabase, userId, lesson.path.id)) {
		return (
			<div className="mx-auto w-full max-w-3xl">
				<PageHeader back={{ href: `/learn/paths/${lesson.path.slug}`, label: lesson.path.title }} title={lesson.title} />
				<PathLockedNotice />
			</div>
		);
	}

	return (
		<div className="mx-auto w-full max-w-3xl">
			<PageHeader
				back={{ href: `/learn/paths/${lesson.path.slug}`, label: lesson.path.title }}
				title={lesson.title}
				description={
					<span className="inline-flex items-center gap-1">
						<Clock className="h-4 w-4" aria-hidden="true" />
						About {lesson.minutes} minutes
					</span>
				}
			/>
			<Card>
				<CardContent className="pt-6">
					<article>
						<Markdown source={lesson.body_md} />
					</article>
					<div className="mt-8 border-t pt-6">
						<LessonActions lessonId={lesson.id} initialStatus={lesson.status} />
					</div>
				</CardContent>
			</Card>
			<LessonNav pathSlug={lesson.path.slug} previous={lesson.previous} next={lesson.next} />
		</div>
	);
}
