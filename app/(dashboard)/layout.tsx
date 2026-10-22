import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";

// Every signed-in screen, settings and profile included, shares this one frame.
export default function DashboardLayout({ children }: { children: ReactNode }) {
	return <AppShell>{children}</AppShell>;
}
