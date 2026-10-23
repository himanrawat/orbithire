import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PageHeader } from "@/components/app/page-header";
import { PrintButton } from "@/components/milestones/PrintButton";
import { PublicProfileView } from "@/components/milestones/PublicProfileView";
import { publicOnly, type Milestone, type PublicProfile } from "@/lib/milestones/model";
import { listMilestones, loadOwnerSummary, loadPublicSettings, type OwnerSummary } from "@/lib/milestones/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export const metadata: Metadata = { title: "Milestones: one-page export", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Print: hide the app frame and show only the sheet, sized to one letter page.
const PRINT_CSS = `
@page { size: letter; margin: 0.6in; }
@media print {
  body * { visibility: hidden; }
  #milestone-sheet, #milestone-sheet * { visibility: visible; }
  #milestone-sheet { position: absolute; inset: 0; border: 0; padding: 0; background: #fff; color: #101216; font-size: 11pt; }
  #milestone-sheet li { break-inside: avoid; }
}
`;

type Scope = "all" | "public";

function parseScope(value: string | string[] | undefined): Scope {
	return value === "public" ? "public" : "all";
}

function toSheet(owner: OwnerSummary, handle: string | null, milestones: Milestone[], scope: Scope): PublicProfile {
	const shown = scope === "public" ? publicOnly(milestones) : milestones;
	return {
		handle: handle ?? "",
		full_name: owner.fullName,
		headline: owner.headline,
		search_indexing: false,
		milestones: shown.map(({ id, kind, title, description, happened_on }) => ({ id, kind, title, description, happened_on })),
		learning: scope === "public" ? owner.learning.slice(0, 5) : [],
	};
}

function ScopeLink({ scope }: Readonly<{ scope: Scope }>) {
	if (scope === "public") {
		return (
			<Link href="/profile/milestones/print" className="text-sm underline underline-offset-2">
				Include private milestones
			</Link>
		);
	}
	return (
		<Link href="/profile/milestones/print?scope=public" className="text-sm underline underline-offset-2">
			Public milestones only
		</Link>
	);
}

export default async function MilestonesPrintPage({
	searchParams,
}: Readonly<{ searchParams?: { [key: string]: string | string[] | undefined } }>) {
	const supabase = createServerSupabase() as unknown as SupabaseClient;
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin?redirect=/profile/milestones/print");

	const scope = parseScope(searchParams?.scope);
	const [owner, milestones, settings] = await Promise.all([
		loadOwnerSummary(supabase, user.id),
		listMilestones(supabase, user.id),
		loadPublicSettings(supabase, user.id),
	]);

	return (
		<div className="mx-auto max-w-4xl px-4 py-8 md:px-8">
			<style>{PRINT_CSS}</style>
			<PageHeader
				back={{ href: "/profile/milestones", label: "Milestones" }}
				title="One-page export"
				description={
					scope === "public"
						? "Your public milestones on one page. Use your browser's print dialog to save it as a PDF."
						: "All your milestones, private ones included, on one page. Use your browser's print dialog to save it as a PDF."
				}
				actions={
					<>
						<ScopeLink scope={scope} />
						<PrintButton />
					</>
				}
			/>
			<div id="milestone-sheet" className="rounded-[var(--radius-md)] border border-border bg-card p-8 md:p-12">
				<PublicProfileView profile={toSheet(owner, settings.public_handle, milestones, scope)} headingLevel={2} />
			</div>
		</div>
	);
}
