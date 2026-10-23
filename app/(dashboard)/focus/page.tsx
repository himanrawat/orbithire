import type { Metadata } from "next";
import { Timer } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { FocusTimer } from "@/components/focus/FocusTimer";
import { WeekSchedule } from "@/components/focus/WeekSchedule";

export const metadata: Metadata = { title: "Focus" };

export default function FocusPage() {
	return (
		<div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
			<PageHeader
				title="Focus"
				description="Pick one task and a length. The timer keeps running offline, and app notifications wait until you're done."
				icon={<Timer />}
			/>
			<div className="space-y-10">
				<div className="max-w-xl">
					<FocusTimer />
				</div>
				<WeekSchedule />
			</div>
		</div>
	);
}
