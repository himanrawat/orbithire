"use client";

// Phone-only bottom tabs (PRD area 8): Today, Learn, Log (+), Jobs, Me. Hidden from md up,
// where the sidebar takes over. 44px+ targets and safe-area padding for the home indicator.

import { useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, GraduationCap, House, Plus, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickLogSheet } from "./QuickLogSheet";

type Tab = Readonly<{ href: string; label: string; icon: ComponentType<{ className?: string }> }>;

const LEFT_TABS: readonly Tab[] = [
	{ href: "/dashboard", label: "Today", icon: House },
	{ href: "/learn", label: "Learn", icon: GraduationCap },
];
const RIGHT_TABS: readonly Tab[] = [
	{ href: "/jobs", label: "Jobs", icon: Briefcase },
	{ href: "/profile", label: "Me", icon: User },
];

export function isTabActive(pathname: string, href: string) {
	return pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass =
	"flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] px-1 py-1.5 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TabLink({ tab, pathname }: Readonly<{ tab: Tab; pathname: string }>) {
	const active = isTabActive(pathname, tab.href);
	const Icon = tab.icon;
	return (
		<li className="flex flex-1">
			<Link
				href={tab.href}
				aria-current={active ? "page" : undefined}
				className={cn(itemClass, active ? "text-foreground" : "text-muted-foreground")}
			>
				<Icon className="h-5 w-5" aria-hidden="true" />
				{tab.label}
			</Link>
		</li>
	);
}

export function MobileTabBar() {
	const pathname = usePathname() ?? "";
	const [logOpen, setLogOpen] = useState(false);
	return (
		<>
			<nav
				aria-label="Main"
				className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[10px] md:hidden"
			>
				<ul className="mx-auto flex max-w-md items-stretch gap-1 px-2 pt-1">
					{LEFT_TABS.map((tab) => (
						<TabLink key={tab.href} tab={tab} pathname={pathname} />
					))}
					<li className="flex flex-1">
						<button
							type="button"
							onClick={() => setLogOpen(true)}
							aria-haspopup="dialog"
							className={cn(itemClass, "text-foreground")}
						>
							<span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground">
								<Plus className="h-4 w-4" aria-hidden="true" />
							</span>
							Log
						</button>
					</li>
					{RIGHT_TABS.map((tab) => (
						<TabLink key={tab.href} tab={tab} pathname={pathname} />
					))}
				</ul>
			</nav>
			<QuickLogSheet open={logOpen} onOpenChange={setLogOpen} />
		</>
	);
}
