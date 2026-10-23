import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { shouldRedirectToOnboarding } from "@/lib/onboarding/server";

// Every signed-in screen, settings and profile included, shares this one frame.
// New accounts that haven't finished or skipped setup go to /onboarding once (it lives
// outside this route group, so this can't loop).
export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
	if (await shouldRedirectToOnboarding()) redirect("/onboarding");
	return <AppShell>{children}</AppShell>;
}
