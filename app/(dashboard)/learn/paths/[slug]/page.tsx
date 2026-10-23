import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, CircleDot, Clock } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { loadPath } from "@/lib/learn/server";
import { lessonHref, type LessonSummary, type ProgressStatus } from "@/lib/learn/types";
import { requirePageUser } from "../../data";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Readonly<Record<ProgressStatus | "none", string>> = {
	done: "Done",
	in_progress: "In progress",
	none: "Not started",
};

function StatusIcon({ status }: Readonly<{ status: ProgressStatus | null }>) {
	if (status === "done") return <CheckCircle2 className="h-5 w-5 text-[var(--kind-learn)]" aria-hidden="true" />;
	if (status === "in_progress") return <CircleDot className="h-5 w-5 text-[var(--kind-learn)]" aria-hidden="true" />;
	return <Circle className="h-5 w-5 text-muted-foreground" aria-hidden="true" />;
}

function LessonRow({ pathSlug, lesson, index }: Readonly<{ pathSlug: string; lesson: LessonSummary; index: number }>) {
	return (
		<li>
			<Link
				href={lessonHref(pathSlug, lesson.slug)}
				className="flex items-center gap-4 rounded-[var(--radius-md)] border bg-card p-4 transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<StatusIcon status={lesson.status} />
				<div className="min-w-0 flex-1">
					<p className="font-semibold">
						<span className="mr-2 font-mono text-sm text-muted-foreground">{index + 1}.</span>
						{lesson.title}
					</p>
					<p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
						<Clock className="h-3.5 w-3.5" aria-hidden="true" />
						{lesson.minutes} min
						<span className="sr-only">, {STATUS_TEXT[lesson.status ?? "none"]}</span>
					</p>
				</div>
			</Link>
		</li>
	);
}

function nextLessonSlug(lessons: readonly LessonSummary[]) {
	return (lessons.find((lesson) => lesson.status !== "done") ?? lessons[0])?.slug ?? null;
}

export default async function PathPage({ params }: Readonly<{ params: { slug: string } }>) {
	const { supabase, userId } = await requirePageUser();
	const detail = await loadPath(supabase, userId, params.slug).catch(() => null);
	if (!detail) notFound();
	const { path, lessons } = detail;
	const resume = nextLessonSlug(lessons);

	return (
		<div className="mx-auto w-full max-w-3xl">
			<PageHeader
				back={{ href: "/learn?tab=paths", label: "Learn" }}
				title={path.title}
				description={path.summary}
				actions={
					resume && (
						<Link
							href={lessonHref(path.slug, resume)}
							className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-cap px-4 text-sm font-semibold text-cap-foreground hover:bg-[var(--cap-press)]"
						>
							{path.doneCount > 0 ? "Continue" : "Start the path"}
						</Link>
					)
				}
			/>
			<p className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<Badge variant="learn">
					{path.doneCount} of {path.lessonCount} done
				</Badge>
				About {path.totalMinutes} minutes in all, in lessons of 8–15 minutes.
			</p>
			<ol className="space-y-3">
				{lessons.map((lesson, index) => (
					<LessonRow key={lesson.id} pathSlug={path.slug} lesson={lesson} index={index} />
				))}
			</ol>
		</div>
	);
}
