import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { PracticeView } from "@/components/prep/PracticeView";

export const metadata: Metadata = { title: "Practice" };

export default function PracticePage({ params }: Readonly<{ params: { questionId: string } }>) {
	return (
		<div className="relative mx-auto max-w-3xl px-4 py-8 md:px-8">
			<PageHeader back={{ href: "/prep", label: "Interview prep" }} title="Practice" />
			<PracticeView questionId={params.questionId} />
		</div>
	);
}
