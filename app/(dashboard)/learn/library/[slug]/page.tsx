import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/learn/Markdown";
import { loadLibraryItem } from "@/lib/learn/server";
import { requirePageUser } from "../../data";

export const dynamic = "force-dynamic";

export default async function LibraryGuidePage({ params }: Readonly<{ params: { slug: string } }>) {
	const { supabase } = await requirePageUser();
	const item = await loadLibraryItem(supabase, params.slug).catch(() => null);
	if (!item) notFound();
	if (item.kind === "link" && item.url) redirect(item.url);

	return (
		<div className="mx-auto w-full max-w-3xl">
			<PageHeader
				back={{ href: "/learn?tab=library", label: "Library" }}
				title={item.title}
				description={item.source_name ? `A short guide from ${item.source_name}` : undefined}
			/>
			<Card>
				<CardContent className="pt-6">
					<article>
						<Markdown source={item.body_md ?? ""} />
					</article>
				</CardContent>
			</Card>
		</div>
	);
}
