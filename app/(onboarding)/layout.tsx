import type { ReactNode } from "react";
import Link from "next/link";
import { Lockup } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/ThemeToggle";

// Setup gets a quiet frame of its own (no sidebar), outside the (dashboard) group so the
// dashboard's "finish setup first" redirect can never loop.
export default function OnboardingLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className="flex min-h-screen flex-col bg-background">
			<header className="flex h-14 items-center justify-between border-b px-4 md:px-8">
				<Link href="/dashboard" aria-label="NextMilestone home" className="flex h-11 w-[132px] items-center text-foreground">
					<Lockup className="block h-auto w-full" />
				</Link>
				<ThemeToggle />
			</header>
			<main id="main" className="flex flex-1 justify-center px-4 py-8 md:py-12">
				{children}
			</main>
		</div>
	);
}
