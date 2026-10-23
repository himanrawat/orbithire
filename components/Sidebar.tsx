"use client";

// The app's sidebar on the brand's night ground (the same ink panel as the sign-in aside),
// in both themes. The active item carries a cap-yellow marker and its area color on the icon.

import { useState, createContext, useContext, ReactNode, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	LayoutDashboard,
	LayoutTemplate,
	Sparkles,
	Building2,
	FileText,
	ChevronsLeft,
	ChevronsRight,
	Menu,
	LogOut,
	Briefcase,
	GraduationCap,
	Flag,
	Settings,
	Timer,
	X,
} from "lucide-react";
import { Lockup, Mark } from "@/components/marketing/logo";

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

export function SidebarProvider({ children }: Readonly<{ children: ReactNode }>) {
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
	icon: React.ComponentType<{ className?: string; style?: CSSProperties }>;
	/** the product-area color the icon takes when active */
	tone: string;
	badge?: number;
};

const mainNavItems: NavItem[] = [
	{ label: "Today", href: "/dashboard", icon: LayoutDashboard, tone: "var(--cap)" },
	{ label: "Focus", href: "/focus", icon: Timer, tone: "var(--kind-focus)" },
	{ label: "Generate Resume", href: "/generate", icon: Sparkles, tone: "var(--kind-prep)" },
	{ label: "Job Inbox", href: "/jobs", icon: Briefcase, tone: "var(--kind-jobs)" },
	{ label: "Learn", href: "/learn", icon: GraduationCap, tone: "var(--kind-learn)" },
	{ label: "Milestones", href: "/profile/milestones", icon: Flag, tone: "var(--cap)" },
	{ label: "Companies", href: "/companies", icon: Building2, tone: "var(--kind-interview)" },
	{ label: "My Resumes", href: "/resumes", icon: FileText, tone: "var(--kind-learn)" },
	{ label: "Templates", href: "/templates", icon: LayoutTemplate, tone: "var(--kind-focus)" },
];

const settingsItem: NavItem = { label: "Settings", href: "/settings", icon: Settings, tone: "var(--night-ink)" };

// The night panel stays light-on-ink in both themes, so its area colors use the
// dark-theme values for contrast, and the logo's ink turns light.
const NIGHT_TONES = {
	"--ink": "var(--night-ink)",
	"--kind-prep": "#d19af0",
	"--kind-jobs": "#8ea8ff",
	"--kind-interview": "#ffa463",
	"--kind-learn": "#57d08e",
	"--kind-focus": "#b9c0cf",
} as CSSProperties;

const rowBase =
	"group relative flex min-h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-[var(--duration-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--night-ink)]";
const rowIdle = "text-[var(--night-muted)] hover:bg-white/[0.06] hover:text-[var(--night-ink)]";

function RowLabel({ isExpanded, children }: Readonly<{ isExpanded: boolean; children: ReactNode }>) {
	return (
		<AnimatePresence mode="wait">
			{isExpanded && (
				<motion.span
					initial={{ opacity: 0, width: 0 }}
					animate={{ opacity: 1, width: "auto" }}
					exit={{ opacity: 0, width: 0 }}
					className="overflow-hidden whitespace-nowrap"
				>
					{children}
				</motion.span>
			)}
		</AnimatePresence>
	);
}

function NavLink({
	item,
	isExpanded,
	onClick,
}: Readonly<{
	item: NavItem;
	isExpanded: boolean;
	onClick?: () => void;
}>) {
	const pathname = usePathname();
	const isActive =
		pathname === item.href || pathname.startsWith(item.href + "/");

	return (
		<Link
			href={item.href}
			onClick={onClick}
			aria-current={isActive ? "page" : undefined}
			className={cn(
				rowBase,
				isActive ? "bg-[var(--night-raised)] text-[var(--night-ink)]" : rowIdle,
				!isExpanded && "justify-center px-0"
			)}
			title={!isExpanded ? item.label : undefined}
		>
			{/* the active marker: a cap on the panel's edge */}
			{isActive && (
				<span
					aria-hidden="true"
					className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--cap)]"
				/>
			)}
			<item.icon
				className="h-5 w-5 shrink-0"
				style={isActive ? { color: item.tone } : undefined}
			/>
			<RowLabel isExpanded={isExpanded}>{item.label}</RowLabel>
			{item.badge !== undefined && isExpanded && (
				<span className="nm-mono ml-auto rounded-full bg-[var(--night-raised)] px-2 text-xs">
					{item.badge}
				</span>
			)}
		</Link>
	);
}

export function Sidebar() {
	const { isExpanded, setIsExpanded, isMobileOpen, setIsMobileOpen } =
		useSidebar();
	const router = useRouter();

	const handleLogout = async () => {
		await fetch("/api/auth/logout", { method: "POST" });
		router.push("/signin");
		router.refresh();
	};

	// The mobile sheet is always expanded and has its own close button instead of collapse.
	const content = (expanded: boolean, mobile: boolean) => (
		<div className="flex h-full flex-col text-[var(--night-ink)]" style={NIGHT_TONES}>
			{/* Logo */}
			<div
				className={cn(
					"flex h-14 items-center justify-between px-4",
					!expanded && "justify-center px-2"
				)}
			>
				<Link
					href="/dashboard"
					aria-label="NextMilestone home"
					onClick={() => setIsMobileOpen(false)}
					className="flex items-center rounded-[var(--radius-sm)] text-[var(--night-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--night-ink)]"
				>
					{expanded ? (
						<Lockup className="block h-6 w-auto" />
					) : (
						<Mark className="h-8 w-auto" stone="var(--night-ink)" />
					)}
				</Link>
				{mobile && (
					<button
						type="button"
						onClick={() => setIsMobileOpen(false)}
						aria-label="Close menu"
						className="grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--night-muted)] hover:bg-white/[0.06] hover:text-[var(--night-ink)]"
					>
						<X className="h-5 w-5" />
					</button>
				)}
			</div>

			{/* Main Nav */}
			<nav aria-label="Main" className="flex-1 space-y-1 px-2 pt-3">
				{mainNavItems.map((item) => (
					<NavLink
						key={item.href}
						item={item}
						isExpanded={expanded}
						onClick={() => setIsMobileOpen(false)}
					/>
				))}
			</nav>

			{/* Bottom */}
			<div className="space-y-1 border-t border-[var(--night-line)] p-2">
				<NavLink item={settingsItem} isExpanded={expanded} onClick={() => setIsMobileOpen(false)} />
				{!mobile && (
					<button
						type="button"
						onClick={() => setIsExpanded(!isExpanded)}
						aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
						aria-expanded={isExpanded}
						className={cn(rowBase, rowIdle, "w-full", !expanded && "justify-center px-0")}
						title={!expanded ? "Expand sidebar" : undefined}
					>
						{expanded ? (
							<ChevronsLeft className="h-5 w-5 shrink-0" />
						) : (
							<ChevronsRight className="h-5 w-5 shrink-0" />
						)}
						<RowLabel isExpanded={expanded}>Collapse</RowLabel>
					</button>
				)}
				<button
					type="button"
					onClick={handleLogout}
					className={cn(rowBase, rowIdle, "w-full", !expanded && "justify-center px-0")}
					title={!expanded ? "Sign out" : undefined}
				>
					<LogOut className="h-5 w-5 shrink-0" />
					<RowLabel isExpanded={expanded}>Sign out</RowLabel>
				</button>
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
				className="nm-grain fixed left-0 top-0 z-40 hidden h-screen bg-[var(--night)] [--grain-o:.35] md:block"
			>
				<div className="relative z-[2] h-full">{content(isExpanded, false)}</div>
			</motion.aside>

			{/* Mobile Overlay */}
			<AnimatePresence>
				{isMobileOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setIsMobileOpen(false)}
						className="fixed inset-0 z-40 bg-[rgba(16,18,22,0.55)] backdrop-blur-[2px] md:hidden"
					/>
				)}
			</AnimatePresence>

			{/* Mobile Sidebar */}
			<AnimatePresence>
				{isMobileOpen && (
					<motion.aside
						initial={{ x: -280 }}
						animate={{ x: 0 }}
						exit={{ x: -280 }}
						transition={{ duration: 0.2, ease: "easeInOut" }}
						className="nm-grain fixed left-0 top-0 z-50 h-screen w-[280px] bg-[var(--night)] [--grain-o:.35] md:hidden"
					>
						<div className="relative z-[2] h-full">{content(true, true)}</div>
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

export function SidebarLayout({ children }: Readonly<{ children: ReactNode }>) {
	const { isExpanded } = useSidebar();

	return (
		<div className="min-h-screen">
			<Sidebar />
			{/* Rendered once: mounting the page twice (desktop + mobile copy) doubled
			    every fetch/effect and duplicated element ids. */}
			<main
				className="transition-[margin] duration-200 ease-in-out md:ml-[var(--sidebar-width)]"
				style={{ "--sidebar-width": isExpanded ? "240px" : "64px" } as CSSProperties}
			>
				{children}
			</main>
		</div>
	);
}
