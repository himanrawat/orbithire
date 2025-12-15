"use client";

import { ReactNode, useState, useEffect } from "react";
import {
	SidebarProvider,
	SidebarLayout,
	MobileMenuButton,
} from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { User, Settings, Sparkles } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

	useEffect(() => {
		fetch("/api/profile")
			.then((res) => res.json())
			.then((data) => {
				if (data.profile?.avatar_url) {
					setAvatarUrl(data.profile.avatar_url);
				}
			})
			.catch(() => {});
	}, []);

	return (
		<SidebarProvider>
			<SidebarLayout>
				{/* Top Bar for Mobile */}
				<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
					<MobileMenuButton />
					<Link href="/" className="font-bold text-lg">
						CVLeap AI
					</Link>
					<div className="flex items-center gap-2">
						<ThemeToggle />
					</div>
				</header>

				{/* Desktop Top Bar */}
				<header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:flex">
					<div className="flex items-center gap-1">
						<NotificationDropdown />
						<ThemeToggle />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="relative">
									{avatarUrl ? (
										<img
											src={avatarUrl}
											alt="Profile"
											className="h-8 w-8 rounded-full object-cover"
										/>
									) : (
										<User className="h-5 w-5" />
									)}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem asChild>
									<Link href="/profile" className="flex items-center gap-2">
										<User className="h-4 w-4" />
										Profile
									</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link href="/settings" className="flex items-center gap-2">
										<Settings className="h-4 w-4" />
										Settings
									</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									disabled
									className="flex items-center justify-between"
								>
									<span className="flex items-center gap-2">
										<Sparkles className="h-4 w-4" />
										Upgrade Plan
									</span>
									<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
										Soon
									</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</header>

				{children}
			</SidebarLayout>
		</SidebarProvider>
	);
}
