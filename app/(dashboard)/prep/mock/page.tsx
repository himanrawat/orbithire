import type { Metadata } from "next";
import { Timer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { MockInterview } from "@/components/prep/MockInterview";

export const metadata: Metadata = { title: "Mock interview" };

export default function MockPage() {
	return (
		<div className="relative mx-auto max-w-3xl px-4 py-8 md:px-8">
			<PageHeader
				back={{ href: "/prep", label: "Interview prep" }}
				icon={<Timer />}
				title="30-minute mock interview"
				description="Practice under time, the way a real round feels. This is practice only, never help during a live interview."
			/>
			<MockInterview />
		</div>
	);
}
