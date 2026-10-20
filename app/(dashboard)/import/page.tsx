import { ImportData } from "@/components/settings/ImportData";

export const metadata = { title: "Import · OrbitHire" };

/** /import – same as Settings → Import, inside the dashboard layout. */
export default function ImportPage() {
	return (
		<div className="container mx-auto max-w-6xl px-4 py-6">
			<ImportData />
		</div>
	);
}
