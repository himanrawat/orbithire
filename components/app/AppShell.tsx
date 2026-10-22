"use client";

// The signed-in app frame: night sidebar, and a paper top bar with notifications, theme and
// the account menu. Used by the (dashboard) route group, which holds every app screen.

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Sparkles, User } from "lucide-react";
import { SidebarProvider, SidebarLayout, MobileMenuButton } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lockup } from "@/components/marketing/logo";

type Me = { name: string | null; email: string | null; avatarUrl: string | null };

function initials(name: string | null, email: string | null) {
	const source = name?.trim() || email || "";
	const parts = source.split(/[\s@.]+/).filter(Boolean);
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function Avatar({ me, size = 32 }: Readonly<{ me: Me; size?: number }>) {
	if (me.avatarUrl) {
		return (
			<img
				src={me.avatarUrl}
				alt=""
				className="rounded-full object-cover"
				style={{ width: size, height: size }}
			/>
		);
	}
	// the arch frame from the profile mock-ups
	return (
		<span
			aria-hidden="true"
			className="nm-arch grid place-items-center bg-secondary text-xs font-semibold text-foreground"
			style={{ width: size, height: size }}
		>
			{initials(me.name, me.email)}
		</span>
	);
}

function AccountMenu({ me }: Readonly<{ me: Me }>) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
					<Avatar me={me} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				{(me.name || me.email) && (
					<>
						<DropdownMenuLabel className="flex items-center gap-3 py-2 text-foreground">
							<Avatar me={me} size={36} />
							<span className="min-w-0">
								<span className="block truncate text-sm font-semibold">{me.name || "Your account"}</span>
								{me.email && <span className="block truncate text-xs font-normal text-muted-foreground">{me.email}</span>}
							</span>
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
					</>
				)}
				<DropdownMenuItem asChild>
					<Link href="/profile">
						<User className="h-4 w-4" />
						Profile
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link href="/settings">
						<Settings className="h-4 w-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled className="justify-between">
					<span className="flex items-center gap-2">
						<Sparkles className="h-4 w-4" />
						Upgrade plan
					</span>
					<span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Soon</span>
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const barClass =
	"sticky top-0 z-30 h-14 items-center border-b bg-background/85 backdrop-blur-[10px] supports-[backdrop-filter]:bg-background/70";

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
	const [me, setMe] = useState<Me>({ name: null, email: null, avatarUrl: null });

	useEffect(() => {
		const load = () =>
			fetch("/api/profile")
				.then((res) => res.json())
				.then((data) => {
					const p = data.profile ?? {};
					setMe({ name: p.full_name ?? null, email: p.email ?? null, avatarUrl: p.avatar_url ?? null });
				})
				.catch(() => {});
		const refreshProfile = () => {
			void load();
		};
		refreshProfile();
		// The profile page fires this after a photo upload or a save
		window.addEventListener("profile:updated", refreshProfile);
		return () => window.removeEventListener("profile:updated", refreshProfile);
	}, []);

	return (
		<SidebarProvider>
			<SidebarLayout>
				{/* Top bar, phone */}
				<header className={`${barClass} flex justify-between px-2 md:hidden`}>
					<MobileMenuButton />
					<Link href="/dashboard" aria-label="NextMilestone home" className="flex h-11 w-[132px] items-center text-foreground">
						<Lockup className="block h-auto w-full" />
					</Link>
					<div className="flex items-center">
						<NotificationDropdown />
						<ThemeToggle />
						<AccountMenu me={me} />
					</div>
				</header>

				{/* Top bar, desktop */}
				<header className={`${barClass} hidden justify-end gap-1 px-6 md:flex`}>
					<NotificationDropdown />
					<ThemeToggle />
					<AccountMenu me={me} />
				</header>

				{children}
			</SidebarLayout>
		</SidebarProvider>
	);
}
