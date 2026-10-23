"use client";

// Admin navigation on the night ground, like the app sidebar. Fixed 256px on desktop; on
// phones a top bar opens it as a sheet (it used to start open and cover the page).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminRoleLabel, canAccessAdminPath, ADMIN_SETTINGS_PATH, type AdminRole } from "@/lib/adminRoles";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	Users,
	MessageSquare,
	Settings,
	CreditCard,
	Shield,
	LogOut,
	Menu,
	UserCheck,
	ListChecks,
	Flag,
	X,
} from "lucide-react";
import { Lockup } from "@/components/marketing/logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const baseNavigation = [
	{ name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
	{ name: "Users", href: "/admin/users", icon: Users },
	{ name: "Admins", href: "/admin/admins", icon: UserCheck },
	{ name: "Moderation", href: "/admin/moderation", icon: Flag },
	{ name: "Contact messages", href: "/admin/contacts", icon: MessageSquare },
	{ name: "Credits & access", href: "/admin/credits", icon: CreditCard },
	{ name: "Access codes", href: "/admin/access-codes", icon: Shield },
	{ name: "Tasks", href: "/admin/tasks", icon: ListChecks },
	{ name: "Settings", href: "/admin/settings", icon: Settings },
];

const rowBase =
	"relative flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-[var(--duration-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--night-ink)]";
const rowIdle = "text-[var(--night-muted)] hover:bg-white/[0.06] hover:text-[var(--night-ink)]";

type AdminSidebarProps = Readonly<{
	adminName?: string;
	adminEmail?: string;
	role: AdminRole;
	mustChangePassword?: boolean;
}>;

// Moderators see only their pages; an admin on a temporary password sees only Settings.
function visibleNavigation(role: AdminRole, mustChangePassword: boolean) {
	if (mustChangePassword) return baseNavigation.filter((item) => item.href === ADMIN_SETTINGS_PATH);
	return baseNavigation.filter((item) => canAccessAdminPath(role, item.href));
}

export function AdminSidebar({
	adminName = "Admin",
	adminEmail,
	role,
	mustChangePassword = false,
}: AdminSidebarProps) {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);
	const navigation = visibleNavigation(role, mustChangePassword);

	// close the sheet when the route changes
	useEffect(() => setMobileOpen(false), [pathname]);

	const handleLogout = async () => {
		await fetch("/api/auth/admin/logout", { method: "POST" });
		window.location.href = "/admin/signin";
	};

	const panel = (mobile: boolean) => (
		<div className="flex h-full flex-col text-[var(--night-ink)]" style={{ "--ink": "var(--night-ink)" } as React.CSSProperties}>
			<div className="flex h-14 items-center justify-between gap-2 px-4">
				<Link href="/admin/dashboard" className="flex items-center gap-2.5 rounded-[var(--radius-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--night-ink)]">
					<Lockup className="block h-[22px] w-auto" />
					<span className="rounded-full bg-[var(--night-raised)] px-2 py-0.5 font-mono text-[11px] text-[var(--night-muted)]">Admin</span>
				</Link>
				{mobile && (
					<button
						type="button"
						onClick={() => setMobileOpen(false)}
						aria-label="Close menu"
						className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--night-muted)] hover:bg-white/[0.06] hover:text-[var(--night-ink)]"
					>
						<X className="h-5 w-5" />
					</button>
				)}
			</div>

			<nav aria-label="Admin" className="flex-1 space-y-1 px-2 pt-3">
				{navigation.map((item) => {
					const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
					return (
						<Link
							key={item.name}
							href={item.href}
							aria-current={isActive ? "page" : undefined}
							className={cn(rowBase, isActive ? "bg-[var(--night-raised)] text-[var(--night-ink)]" : rowIdle)}
						>
							{isActive && (
								<span aria-hidden="true" className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--cap)]" />
							)}
							<item.icon className="h-5 w-5 shrink-0" />
							<span>{item.name}</span>
						</Link>
					);
				})}
			</nav>

			<div className="border-t border-[var(--night-line)] p-2">
				<div className="px-3 py-2">
					<p className="truncate text-sm font-semibold">{adminName}</p>
					{adminEmail && <p className="truncate text-xs text-[var(--night-muted)]">{adminEmail}</p>}
					<p className="mt-1 font-mono text-[11px] text-[var(--night-muted)]">{adminRoleLabel(role)}</p>
				</div>
				<button type="button" onClick={handleLogout} className={cn(rowBase, rowIdle, "w-full")}>
					<LogOut className="h-5 w-5 shrink-0" />
					Sign out
				</button>
			</div>
		</div>
	);

	return (
		<>
			{/* phone top bar */}
			<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-2 backdrop-blur-[10px] lg:hidden">
				<button
					type="button"
					onClick={() => setMobileOpen(true)}
					aria-label="Open menu"
					aria-expanded={mobileOpen}
					className="grid size-11 place-items-center rounded-[var(--radius-control)] hover:bg-accent"
				>
					<Menu className="h-5 w-5" />
				</button>
				<span className="flex items-center gap-2 text-foreground">
					<Lockup className="block h-5 w-auto" />
					<span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">Admin</span>
				</span>
				<ThemeToggle />
			</header>

			{/* desktop */}
			<aside className="nm-grain fixed inset-y-0 left-0 z-40 hidden w-64 bg-[var(--night)] [--grain-o:.35] lg:block">
				<div className="relative z-[2] h-full">{panel(false)}</div>
			</aside>

			{/* phone sheet */}
			{mobileOpen && (
				<>
					<div
						onClick={() => setMobileOpen(false)}
						className="fixed inset-0 z-40 bg-[rgba(16,18,22,0.55)] backdrop-blur-[2px] lg:hidden"
						aria-hidden="true"
					/>
					<aside className="nm-grain fixed inset-y-0 left-0 z-50 w-[280px] bg-[var(--night)] [--grain-o:.35] lg:hidden">
						<div className="relative z-[2] h-full">{panel(true)}</div>
					</aside>
				</>
			)}
		</>
	);
}
