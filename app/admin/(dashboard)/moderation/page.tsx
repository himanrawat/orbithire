import { Flag } from "lucide-react";
import { requireAdminPage } from "@/lib/adminAuth";
import { loadModerationQueue, QUEUE_LIMIT } from "@/lib/community/moderationServer";
import type { QueueReport } from "@/lib/community/moderation";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/community/types";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/blocks";
import { LocalDate } from "@/components/LocalDate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ModerationActions } from "@/components/admin/ModerationActions";

export const dynamic = "force-dynamic";

const TARGET_LABEL = { post: "Post", reply: "Reply", user: "Member" } as const;

function reasonLabel(reason: string) {
	return REPORT_REASON_LABELS[reason as ReportReason] ?? reason;
}

function PreviewStatus({ report }: Readonly<{ report: QueueReport }>) {
	const { preview } = report;
	if (preview.missing) return <Badge variant="secondary">Deleted</Badge>;
	return (
		<>
			{preview.hidden && <Badge variant="destructive">Hidden</Badge>}
			{preview.suspended && <Badge variant="warning">Member suspended</Badge>}
		</>
	);
}

function ReportItem({ report }: Readonly<{ report: QueueReport }>) {
	const { preview } = report;
	const canHide = report.targetType !== "user" && !preview.missing && !preview.hidden;
	const canSuspend = !!preview.authorId && !preview.suspended;
	return (
		<li className="space-y-3 border-b px-4 py-4 last:border-b-0">
			<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
				<p className="font-medium">
					{reasonLabel(report.reason)}
					<span className="ml-2 text-sm text-muted-foreground">· {TARGET_LABEL[report.targetType]}</span>
				</p>
				<p className="text-sm text-muted-foreground">
					<LocalDate value={report.createdAt} withTime />
				</p>
			</div>
			{report.details && <p className="text-sm text-muted-foreground">Reporter: {report.details}</p>}
			<blockquote className="rounded-[var(--radius-md)] border bg-secondary/40 p-3 text-sm">
				<p className="flex flex-wrap items-center gap-2 font-semibold">
					{preview.headline}
					<PreviewStatus report={report} />
				</p>
				{preview.excerpt && <p className="mt-1 whitespace-pre-line text-muted-foreground">{preview.excerpt}</p>}
				{preview.authorName && report.targetType !== "user" && (
					<p className="mt-2 text-xs text-muted-foreground">By {preview.authorName}</p>
				)}
			</blockquote>
			<ModerationActions reportId={report.id} canHide={canHide} canSuspend={canSuspend} />
		</li>
	);
}

function ReportQueue({ reports }: Readonly<{ reports: QueueReport[] }>) {
	if (reports.length === 0) {
		return (
			<EmptyState
				icon={<Flag aria-hidden="true" />}
				title="No open reports"
				description="When someone reports a community post, reply or member, it shows up here for review."
			/>
		);
	}
	return (
		<ul aria-label="Open reports">
			{reports.map((report) => (
				<ReportItem key={report.id} report={report} />
			))}
		</ul>
	);
}

export default async function ModerationPage() {
	await requireAdminPage("moderator");
	const { reports } = await loadModerationQueue();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Moderation"
				description={`Open community reports, newest first. Shows the latest ${QUEUE_LIMIT}. Every action is logged.`}
				className="mb-0"
			/>
			<Card>
				<CardContent className="p-0">
					<ReportQueue reports={reports} />
				</CardContent>
			</Card>
		</div>
	);
}
