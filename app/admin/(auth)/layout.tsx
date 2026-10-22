import type { ReactNode } from "react";
import Link from "next/link";
import { brandFonts } from "@/app/fonts";
import "@/components/marketing/nextmilestone.css";
import { Lockup } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/ThemeToggle";

// Admin sign in and sign up: the brand's fonts and tokens, with a plain header instead of
// the marketing navbar.
export default function AdminAuthLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className={`nm ${brandFonts} flex min-h-screen flex-col overflow-x-clip`}>
			<header className="nm-wrap flex h-14 w-full items-center justify-between">
				<Link href="/" aria-label="NextMilestone home" className="flex items-center gap-3">
					<Lockup className="block h-auto w-[148px]" />
					<span className="nm-mono rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-xs font-medium text-[var(--ink-muted)]">Admin</span>
				</Link>
				<ThemeToggle />
			</header>
			<main id="main" className="flex flex-1">
				{children}
			</main>
		</div>
	);
}
