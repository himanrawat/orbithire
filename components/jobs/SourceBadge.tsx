import { Badge } from "@/components/ui/badge";
import { sourceAttribution, sourceLabel } from "@/lib/jobs/sourceRegistry";

type SourceBadgeProps = Readonly<{
	source: string;
	url: string | null;
}>;

/**
 * Where a posting came from. Aggregators whose terms require credit (Himalayas, Jobicy,
 * Remote OK, ...) get a visible "via <source>" link back to their listing.
 */
export function SourceBadge({ source, url }: SourceBadgeProps) {
	const attribution = sourceAttribution(source, url);
	if (!attribution) return <Badge variant="outline">{sourceLabel(source)}</Badge>;
	return (
		<Badge variant="outline">
			<a href={attribution.href} target="_blank" rel="noopener" className="hover:underline">
				via {attribution.label}
			</a>
		</Badge>
	);
}
