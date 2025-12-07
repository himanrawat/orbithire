"use client";

import { ReactNode } from "react";
import {
	SidebarProvider,
	SidebarLayout,
	MobileMenuButton,
} from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Bell, LogOut } from "lucide-react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<SidebarProvider>
			<SidebarLayout>
				{/* Top Bar for Mobile */}
				<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
					<MobileMenuButton />
					<Link href="/" className="font-bold text-lg">
						OrbitHire
					</Link>
					<div className="flex items-center gap-2">
						<ThemeToggle />
					</div>
				</header>

				{/* Desktop Top Bar */}
				<header className="sticky top-0 z-30 hidden h-14 items-center justify-end gap-4 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:flex">
					<Button variant="ghost" size="icon">
						<Bell className="h-5 w-5" />
					</Button>
					<ThemeToggle />
					<Button variant="ghost" size="sm" asChild>
						<Link href="/api/auth/logout">
							<LogOut className="mr-2 h-4 w-4" />
							Sign out
						</Link>
					</Button>
				</header>

				{children}
			</SidebarLayout>
		</SidebarProvider>
	);
}
