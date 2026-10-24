import type { Metadata } from "next";
import { TodayView } from "@/components/today/TodayView";

export const metadata: Metadata = { title: "Today" };

export default function DashboardPage() {
	return (
		<div className="relative mx-auto max-w-7xl px-4 py-8 md:px-8">
			<TodayView />
		</div>
	);
}
