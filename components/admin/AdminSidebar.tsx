"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	Users,
	MessageSquare,
	Settings,
	CreditCard,
	Shield,
	LogOut,
	ChevronLeft,
	Menu,
	UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

const baseNavigation = [
	{
		name: "Dashboard",
		href: "/admin/dashboard",
		icon: LayoutDashboard,
	},
	{
		name: "Users",
		href: "/admin/users",
		icon: Users,
	},
	{
		name: "Admins",
		href: "/admin/admins",
		icon: UserCheck,
	},
	{
		name: "Contact Submissions",
		href: "/admin/contacts",
		icon: MessageSquare,
	},
	{
		name: "Credits & Access",
		href: "/admin/credits",
		icon: CreditCard,
	},
	{
		name: "Access Codes",
		href: "/admin/access-codes",
		icon: Shield,
	},
	{
		name: "Settings",
		href: "/admin/settings",
		icon: Settings,
	},
];

interface AdminSidebarProps {
	adminName?: string;
	adminEmail?: string;
}

export function AdminSidebar({ adminName = "Admin", adminEmail }: AdminSidebarProps) {
	const pathname = usePathname();
	const [collapsed, setCollapsed] = useState(false);
	const [role, setRole] = useState<"admin" | "super_admin" | null>(null);

	useEffect(() => {
		const fetchRole = async () => {
			try {
				const res = await fetch("/api/auth/admin/verify", { cache: "no-store" });
				if (res.ok) {
					const data = await res.json();
					setRole(data.role);
				}
			} catch {
				setRole(null);
			}
		};
		fetchRole();
	}, []);

	const handleLogout = async () => {
		await fetch("/api/auth/admin/logout", { method: "POST" });
		window.location.href = "/admin/signin";
	};

	return (
		<>
			{/* Mobile menu button */}
			<Button
				variant="ghost"
				size="icon"
				className="fixed top-4 left-4 z-50 lg:hidden"
				onClick={() => setCollapsed(!collapsed)}
			>
				<Menu className="h-5 w-5" />
			</Button>

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-card transition-all duration-300",
					collapsed ? "w-16" : "w-64",
					"max-lg:translate-x-0",
					collapsed && "max-lg:-translate-x-full"
				)}
			>
				{/* Header */}
				<div className="flex h-16 items-center justify-between border-b px-4">
					{!collapsed && (
						<Link href="/admin/dashboard" className="flex items-center gap-2">
							<Shield className="h-6 w-6 text-primary" />
							<span className="font-semibold">Admin Panel</span>
						</Link>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="hidden lg:flex"
						onClick={() => setCollapsed(!collapsed)}
					>
						<ChevronLeft
							className={cn(
								"h-4 w-4 transition-transform",
								collapsed && "rotate-180"
							)}
						/>
					</Button>
				</div>

				{/* Navigation */}
				<nav className="flex-1 space-y-1 p-2">
					{baseNavigation
						.filter((item) => item.name !== "Admins" || role === "super_admin")
						.map((item) => {
						const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
						return (
							<Link
								key={item.name}
								href={item.href}
								className={cn(
									"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								<item.icon className="h-5 w-5 shrink-0" />
								{!collapsed && <span>{item.name}</span>}
							</Link>
						);
					})}
				</nav>

				{/* Footer */}
				<div className="border-t p-4">
					{!collapsed && (
						<div className="mb-4">
							<p className="text-sm font-medium truncate">{adminName}</p>
							{adminEmail && (
								<p className="text-xs text-muted-foreground truncate">{adminEmail}</p>
							)}
						</div>
					)}
					<Button
						variant="ghost"
						className={cn(
							"w-full justify-start gap-3 text-muted-foreground hover:text-foreground",
							collapsed && "justify-center px-0"
						)}
						onClick={handleLogout}
					>
						<LogOut className="h-5 w-5 shrink-0" />
						{!collapsed && <span>Logout</span>}
					</Button>
				</div>
			</aside>
		</>
	);
}
