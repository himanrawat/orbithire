import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline", robots: { index: false } };
export const dynamic = "force-static";

// Precached by public/sw.js and shown when a page can't load without a connection.
// No user data here: it's safe to keep in the cache.
export default function OfflinePage() {
	return (
		<main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
			<WifiOff className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
			<h1 className="text-2xl font-semibold">You&apos;re offline</h1>
			<p className="text-muted-foreground">
				This page needs a connection. The focus timer still works, and anything you log on this phone syncs when
				you&apos;re back online.
			</p>
			<nav aria-label="Available offline" className="flex flex-wrap justify-center gap-3">
				<Link href="/focus" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-4 font-medium">
					Open Focus
				</Link>
				<Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-4 font-medium">
					Try Today again
				</Link>
			</nav>
		</main>
	);
}
