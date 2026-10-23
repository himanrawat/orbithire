import { Flag } from "lucide-react";
import { requireAdminPage } from "@/lib/adminAuth";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { isMissingTableError, normalizeReports, type ModerationReport } from "@/lib/adminModeration";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/blocks";
import { LocalDate } from "@/components/LocalDate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const QUEUE_LIMIT = 50;

// Shell for the community moderation queue. Review actions arrive with Community;
// until its `content_reports` table exists this shows the empty state.
async function getReports(): Promise<ModerationReport[]> {
	const { data, error } = await createServiceSupabase()
		.from("content_reports")
		.select("*")
		.order("created_at", { ascending: false })
		.limit(QUEUE_LIMIT);

	if (error) {
		if (!isMissingTableError(error)) console.error("Error fetching content reports:", error);
		return [];
	}
	return normalizeReports(data);
}

function ReportItem({ report }: Readonly<{ report: ModerationReport }>) {
	return (
		<li className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
			<div className="min-w-0">
				<p className="font-medium">
					{report.reason}
					{report.targetType && <span className="ml-2 text-sm text-muted-foreground">· {report.targetType}</span>}
				</p>
				{report.details && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{report.details}</p>}
			</div>
			<div className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
				<Badge variant="secondary">{report.status}</Badge>
				<LocalDate value={report.createdAt} withTime />
			</div>
		</li>
	);
}

function ReportQueue({ reports }: Readonly<{ reports: ModerationReport[] }>) {
	if (reports.length === 0) {
		return (
			<EmptyState
				icon={<Flag aria-hidden="true" />}
				title="No reports yet"
				description="When someone reports a community post or comment, it shows up here for review."
			/>
		);
	}
	return (
		<ul aria-label="Reported content">
			{reports.map((report) => (
				<ReportItem key={report.id} report={report} />
			))}
		</ul>
	);
}

export default async function ModerationPage() {
	await requireAdminPage("moderator");
	const reports = await getReports();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Moderation"
				description={`Community reports, newest first. Shows the latest ${QUEUE_LIMIT}.`}
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
