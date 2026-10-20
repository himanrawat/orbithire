"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	Sparkles,
	Building2,
	FileText,
	ChevronLeft,
	ChevronRight,
	Menu,
	LogOut,
	Briefcase,
} from "lucide-react";

type SidebarContextType = {
	isExpanded: boolean;
	setIsExpanded: (value: boolean) => void;
	isMobileOpen: boolean;
	setIsMobileOpen: (value: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function useSidebar() {
	const context = useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider");
	}
	return context;
}

export function SidebarProvider({ children }: { children: ReactNode }) {
	const [isExpanded, setIsExpanded] = useState(true);
	const [isMobileOpen, setIsMobileOpen] = useState(false);

	return (
		<SidebarContext.Provider
			value={{ isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen }}
		>
			{children}
		</SidebarContext.Provider>
	);
}

type NavItem = {
	label: string;
	href: string;
	icon: React.ComponentType<{ className?: string }>;
	badge?: number;
};

const mainNavItems: NavItem[] = [
	{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
	{ label: "Generate Resume", href: "/generate", icon: Sparkles },
	{ label: "Job Inbox", href: "/jobs", icon: Briefcase },
	{ label: "Companies", href: "/companies", icon: Building2 },
	{ label: "My Resumes", href: "/resumes", icon: FileText },
];

function NavLink({
	item,
	isExpanded,
	onClick,
}: {
	item: NavItem;
	isExpanded: boolean;
	onClick?: () => void;
}) {
	const pathname = usePathname();
	const isActive =
		pathname === item.href || pathname.startsWith(item.href + "/");

	return (
		<Link
			href={item.href}
			onClick={onClick}
			className={cn(
				"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
				isActive
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:bg-accent hover:text-foreground",
				!isExpanded && "justify-center px-2"
			)}
			title={!isExpanded ? item.label : undefined}
		>
			<item.icon className={cn("h-5 w-5 shrink-0")} />
			<AnimatePresence mode="wait">
				{isExpanded && (
					<motion.span
						initial={{ opacity: 0, width: 0 }}
						animate={{ opacity: 1, width: "auto" }}
						exit={{ opacity: 0, width: 0 }}
						className="overflow-hidden whitespace-nowrap"
					>
						{item.label}
					</motion.span>
				)}
			</AnimatePresence>
			{item.badge !== undefined && isExpanded && (
				<span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-xs">
					{item.badge}
				</span>
			)}
		</Link>
	);
}

export function Sidebar() {
	const { isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen } =
		useSidebar();
	const pathname = usePathname();
	const router = useRouter();

	const handleLogout = async () => {
		await fetch("/api/auth/logout", { method: "POST" });
		router.push("/signin");
		router.refresh();
	};

	const sidebarContent = (
		<div className="flex h-full flex-col">
			{/* Logo */}
			<div
				className={cn(
					"flex h-14 items-center border-b px-4 relative",
					!isExpanded && "justify-center px-2"
				)}
			>
				<Link href="/" className="flex items-center gap-2">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
						<Sparkles className="h-4 w-4 text-primary-foreground" />
					</div>
					<AnimatePresence mode="wait">
						{isExpanded && (
							<motion.span
								initial={{ opacity: 0, width: 0 }}
								animate={{ opacity: 1, width: "auto" }}
								exit={{ opacity: 0, width: 0 }}
								className="overflow-hidden whitespace-nowrap font-bold text-lg"
							>
								CVLeap AI
							</motion.span>
						)}
					</AnimatePresence>
				</Link>
				{/* Collapse Button (Desktop) */}
				<div className="mt-2 hidden md:block absolute -right-10">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsExpanded(!isExpanded)}
						className={cn(
							"w-full justify-center",
							isExpanded && "justify-start"
						)}
					>
						{isExpanded ? (
							<>
								<ChevronLeft className="h-4 w-4" />
							</>
						) : (
							<ChevronRight className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Main Nav */}
			<nav className="flex-1 space-y-1 p-2">
				{mainNavItems.map((item) => (
					<NavLink
						key={item.href}
						item={item}
						isExpanded={isExpanded}
						onClick={() => setIsMobileOpen(false)}
					/>
				))}
			</nav>

			{/* Bottom Nav */}
			<div className="border-t p-2">
				<nav className="space-y-1">
					<button
						onClick={handleLogout}
						className={cn(
							"flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
							!isExpanded && "justify-center px-2"
						)}
						title={!isExpanded ? "Sign out" : undefined}
					>
						<LogOut className="h-5 w-5 shrink-0" />
						<AnimatePresence mode="wait">
							{isExpanded && (
								<motion.span
									initial={{ opacity: 0, width: 0 }}
									animate={{ opacity: 1, width: "auto" }}
									exit={{ opacity: 0, width: 0 }}
									className="overflow-hidden whitespace-nowrap"
								>
									Sign out
								</motion.span>
							)}
						</AnimatePresence>
					</button>
				</nav>
			</div>
		</div>
	);

	return (
		<>
			{/* Desktop Sidebar */}
			<motion.aside
				initial={false}
				animate={{ width: isExpanded ? 240 : 64 }}
				transition={{ duration: 0.2, ease: "easeInOut" }}
				className="fixed left-0 top-0 z-40 hidden h-screen border-r bg-background md:block"
			>
				{sidebarContent}
			</motion.aside>

			{/* Mobile Overlay */}
			<AnimatePresence>
				{isMobileOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setIsMobileOpen(false)}
						className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
					/>
				)}
			</AnimatePresence>

			{/* Mobile Sidebar */}
			<AnimatePresence>
				{isMobileOpen && (
					<motion.aside
						initial={{ x: -240 }}
						animate={{ x: 0 }}
						exit={{ x: -240 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
						className="fixed left-0 top-0 z-50 h-screen w-60 border-r bg-background md:hidden"
					>
						{sidebarContent}
					</motion.aside>
				)}
			</AnimatePresence>
		</>
	);
}

export function MobileMenuButton() {
	const { setIsMobileOpen } = useSidebar();

	return (
		<Button
			variant="ghost"
			size="icon"
			className="md:hidden"
			onClick={() => setIsMobileOpen(true)}
		>
			<Menu className="h-5 w-5" />
			<span className="sr-only">Open menu</span>
		</Button>
	);
}

export function SidebarLayout({ children }: { children: ReactNode }) {
	const { isExpanded } = useSidebar();

	return (
		<div className="min-h-screen">
			<Sidebar />
			<motion.main
				initial={false}
				animate={{ marginLeft: isExpanded ? 240 : 64 }}
				transition={{ duration: 0.2, ease: "easeInOut" }}
				className="hidden md:block"
			>
				{children}
			</motion.main>
			<main className="md:hidden">{children}</main>
		</div>
	);
}
