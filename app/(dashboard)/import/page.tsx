import { Upload } from "lucide-react";
import { ImportData } from "@/components/settings/ImportData";
import { PageHeader } from "@/components/app/page-header";

export const metadata = { title: "Import" };

/** /import – same as Settings → Import, inside the dashboard layout. */
export default function ImportPage() {
	return (
		<div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
			<PageHeader
				icon={<Upload />}
				title="Import"
				description="Bring in applications, PDFs and your profile from an earlier job search. You review everything before it's saved."
			/>
			<ImportData />
		</div>
	);
}
