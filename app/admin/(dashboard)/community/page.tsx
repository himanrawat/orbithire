import { requireAdminPage } from "@/lib/adminAuth";
import { loadCommunityAdmin } from "@/lib/community/moderationServer";
import { PageHeader } from "@/components/app/page-header";
import { CommunityAdmin } from "@/components/admin/CommunityAdmin";

export const dynamic = "force-dynamic";

export default async function AdminCommunityPage() {
	await requireAdminPage("admin");
	const data = await loadCommunityAdmin();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Community"
				description="Invite-only at launch, starting with one US field."
				className="mb-0"
			/>
			{data.unavailable ? (
				<output className="block rounded-[var(--radius-md)] border bg-card p-4 text-sm text-muted-foreground">
					Community tables aren&apos;t set up yet. Run the 20261024001100_community migration.
				</output>
			) : (
				<CommunityAdmin
					launchField={data.launchField}
					memberCount={data.memberCount}
					invites={data.invites}
					requests={data.requests}
				/>
			)}
		</div>
	);
}
