import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { PrepView } from "@/components/prep/PrepView";

export const metadata: Metadata = { title: "Interview prep" };

export default function PrepPage() {
	return (
		<div className="relative mx-auto max-w-5xl px-4 py-8 md:px-8">
			<PageHeader
				icon={<MessagesSquare />}
				title="Interview prep"
				description="Practice before the interview: think, answer out loud or in writing, then review one strength, one gap and one thing to read next."
			/>
			<Suspense fallback={null}>
				<PrepView />
			</Suspense>
		</div>
	);
}
