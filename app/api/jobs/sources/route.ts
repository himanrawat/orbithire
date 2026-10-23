import { NextResponse } from "next/server";
import { requireUser, serverError } from "@/lib/jobs/server";
import { SOURCE_REGISTRY, type SourcePolicy } from "@/lib/jobs/sourceRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toRow(s: SourcePolicy) {
	return {
		id: s.id,
		label: s.label,
		kind: s.kind,
		legal_basis: s.legalBasis,
		home_url: s.homeUrl,
		tos_restricted: s.tosRestricted,
		india_only: s.indiaOnly,
		attribution_required: s.attributionRequired,
	};
}

// GET /api/jobs/sources – the job source registry: legal basis, attribution rules and
// production gates per source (job_sources table, falling back to the code constant),
// plus the size of the shared US company watchlist.
export async function GET() {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const [sources, watchlist] = await Promise.all([
		auth.supabase
			.from("job_sources")
			.select("id,label,kind,legal_basis,home_url,tos_restricted,india_only,attribution_required")
			.order("id", { ascending: true }),
		auth.supabase.from("company_watchlist").select("id", { count: "exact", head: true }),
	]);
	if (sources.error) return serverError("Failed to load job sources", sources.error);
	return NextResponse.json({
		sources: sources.data?.length ? sources.data : SOURCE_REGISTRY.map(toRow),
		watchlist_companies: watchlist.count ?? 0,
	});
}
