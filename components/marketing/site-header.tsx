"use client";

// Navbar from 21st.dev solaceui/navbar-section-2: the logo and call to action sit on the page,
// and the links live in a dark notch hanging from the top edge, with concave corners, that
// springs open into a panel. Only the navbar is taken; recoloured to the NextMilestone tokens.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Btn } from "./btn";
import { Lockup } from "./logo";

type PanelId = "product" | "company";

type NavItem = {
	label: string;
	href?: string;
	panelId?: PanelId;
};

type PanelCardItem = {
	title: string;
	href: string;
	description?: string;
	component?: ReactNode;
};

type MenuPanel = {
	id: PanelId;
	items: PanelCardItem[];
};

const navItems: NavItem[] = [
	{ label: "Product", panelId: "product" },
	{ label: "Today", href: "/product/today" },
	{ label: "Community", href: "/community" },
	{ label: "Pricing", href: "/pricing" },
	{ label: "Questions", href: "/faq" },
	{ label: "Company", panelId: "company" },
];

const menuPanels: MenuPanel[] = [
	{
		id: "product",
		items: [
			{ title: "Today", href: "/product/today", component: <TodayPreview /> },
			{ title: "Interview prep", href: "/product/interview-prep", component: <PrepPreview /> },
			{ title: "Focus", href: "/product/focus", description: "25, 50 or 90 minutes tied to one task" },
			{ title: "Jobs and learning", href: "/product/jobs-and-learning", description: "Matches every morning, skills they ask for" },
		],
	},
	{
		id: "company",
		items: [
			{ title: "Contact", href: "/contact", description: "Write to us. A person reads every message and replies." },
			{ title: "Privacy", href: "/privacy", description: "What we store, why, and how to take it with you or delete it." },
			{ title: "Terms", href: "/terms", description: "The agreement for using NextMilestone, in plain language." },
		],
	},
];

function getPanel(panelId: string | null) {
	return menuPanels.find((panel) => panel.id === panelId);
}

function TodayPreview() {
	return (
		<div className="relative z-10 grid w-full gap-1.5 rounded-lg border border-[var(--night-line)] bg-[var(--night)] p-2">
			<div className="rounded-md bg-[var(--night-raised)] p-2">
				<p className="text-[10px] font-semibold text-[var(--cap)]">Your next step</p>
				<p className="mt-0.5 text-[11px] font-semibold leading-[14px] text-[var(--night-ink)]">Practice “Design a URL shortener”</p>
				<p className="mt-0.5 text-[10px] leading-[13px] text-[var(--night-muted)]">Your interview is in 2 days.</p>
				<span className="mt-1.5 inline-block rounded bg-[var(--cap)] px-1.5 py-0.5 text-[10px] font-semibold text-[#101216]">
					Start · 20 min
				</span>
			</div>
			<p className="nm-mono flex justify-between px-0.5 text-[10px] text-[var(--night-muted)]">
				Today&apos;s plan <span>2 of 4 done</span>
			</p>
		</div>
	);
}

function PrepPreview() {
	return (
		<div className="relative z-10 grid w-full gap-1.5 rounded-lg border border-[var(--night-line)] bg-[var(--night)] p-2 text-[10px] leading-[13px]">
			<span className="w-fit rounded-full bg-[var(--night-raised)] px-1.5 py-px text-[var(--night-muted)]">Reported by 38 people</span>
			<p className="text-[11px] font-semibold leading-[14px] text-[var(--night-ink)]">Design a URL shortener for 10,000 writes a second.</p>
			<div className="rounded-md border border-dashed border-[var(--night-line)] p-1.5 text-[var(--night-muted)]">
				<b className="font-semibold text-[var(--night-ink)]">AI draft · Gap:</b> how cached links are invalidated.
			</div>
		</div>
	);
}

function HeaderLink({
	href,
	className,
	onClick,
	children,
}: Readonly<{
	href: string;
	className?: string;
	onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
	children: ReactNode;
}>) {
	// Native anchors give same-page section links predictable preventDefault semantics. Next's
	// client navigation can otherwise write the hash after the click handler has removed it.
	if (href.includes("#")) {
		return (
			<a href={href} className={className} onClick={onClick}>
				{children}
			</a>
		);
	}

	return (
		<Link href={href} className={className} onClick={onClick}>
			{children}
		</Link>
	);
}

function PanelCard({
	item,
	compact = false,
	onPick,
}: Readonly<{
	item: PanelCardItem;
	compact?: boolean;
	onPick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}>) {
	const shell =
		"group relative flex overflow-hidden rounded-xl border border-[var(--night-line)] bg-white/[0.02] transition-colors hover:border-[var(--line-control)] hover:bg-white/[0.04]";

	if (item.component) {
		return (
			<HeaderLink href={item.href} onClick={(event) => onPick(event, item.href)} className={`${shell} h-[180px] flex-col justify-between gap-2 p-3`}>
				{item.component}
				<span className="relative z-10 mt-auto block text-center text-xs font-medium text-[var(--night-muted)] transition-colors group-hover:text-[var(--night-ink)]">
					{item.title}
				</span>
			</HeaderLink>
		);
	}

	return (
		<HeaderLink
			href={item.href}
			onClick={(event) => onPick(event, item.href)}
			className={compact ? `${shell} h-[86px] flex-col justify-center p-3` : `${shell} min-h-[132px] flex-col justify-between p-4`}
		>
			<div className="relative z-10">
				<h4 className={`${compact ? "text-sm" : "text-base"} font-semibold text-[var(--night-ink)]`}>{item.title}</h4>
				<p className="mt-1 text-xs leading-[16px] text-[var(--night-muted)]">{item.description}</p>
			</div>
			{!compact && (
				<span className="relative z-10 mt-5 text-xs font-medium text-[var(--night-muted)] group-hover:text-[var(--cap)]">
					Open <ArrowRight className="ml-1 inline size-3" />
				</span>
			)}
		</HeaderLink>
	);
}

function DropdownPanel({
	panel,
	onPick,
}: Readonly<{
	panel: MenuPanel;
	onPick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void;
}>) {
	if (panel.id === "product") {
		const [today, prep, focus, jobs] = panel.items;
		return (
			<div className="grid grid-cols-[1.2fr_1.2fr_1fr] gap-4 p-4">
				<PanelCard item={today} onPick={onPick} />
				<PanelCard item={prep} onPick={onPick} />
				<div className="flex flex-col gap-2">
					<PanelCard item={focus} compact onPick={onPick} />
					<PanelCard item={jobs} compact onPick={onPick} />
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-3 gap-4 p-4">
			{panel.items.map((item) => (
				<PanelCard key={item.title} item={item} onPick={onPick} />
			))}
		</div>
	);
}

export function SiteHeader({ redirectQuery = "" }: Readonly<{ redirectQuery?: string }>) {
	const [activeMenu, setActiveMenu] = useState<PanelId | null>(null);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [mobileActiveMenu, setMobileActiveMenu] = useState<PanelId | null>(null);
	const notchRef = useRef<HTMLDivElement>(null);
	const activePanel = getPanel(activeMenu);

	const toggleMenu = (id: PanelId) => setActiveMenu(activeMenu === id ? null : id);
	const closeAll = () => {
		setActiveMenu(null);
		setMobileOpen(false);
		setMobileActiveMenu(null);
	};
	const handleNavClick = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
		closeAll();
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

		const url = new URL(href, window.location.href);
		if (url.origin !== window.location.origin || url.pathname !== "/" || !url.hash || window.location.pathname !== "/") return;

		const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
		if (!target) return;

		event.preventDefault();
		const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
		target.scrollIntoView({ behavior, block: "start" });
		const cleanUrl = window.location.pathname + window.location.search;
		window.history.replaceState(window.history.state, "", cleanUrl);
	};

	// close the open panel on Escape or a click outside the notch
	useEffect(() => {
		if (!activeMenu) return;
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActiveMenu(null);
		const onDown = (e: PointerEvent) => {
			if (!notchRef.current?.contains(e.target as Node)) setActiveMenu(null);
		};
		document.addEventListener("keydown", onKey);
		document.addEventListener("pointerdown", onDown);
		return () => {
			document.removeEventListener("keydown", onKey);
			document.removeEventListener("pointerdown", onDown);
		};
	}, [activeMenu]);

	// When arriving from another page, use the hash once to find the section and then remove it
	// from the address bar. Home-page section clicks are handled directly by handleNavClick.
	useEffect(() => {
		if (location.pathname !== "/") return;
		let timer = 0;
		if (location.hash) {
			const id = location.hash.slice(1);
			// wait for the pinned focus section to add its spacer before measuring
			timer = window.setTimeout(() => {
				const target = document.getElementById(decodeURIComponent(id));
				if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
				window.history.replaceState(window.history.state, "", location.pathname + location.search);
			}, 300);
		}
		return () => clearTimeout(timer);
	}, []);

	return (
		<header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-[10px]">
			{/* desktop */}
			<div className="nm-wrap relative z-30 hidden h-14 items-center justify-between lg:flex">
				<Link href="/" aria-label="NextMilestone home" className="block w-[168px]">
					<Lockup className="block h-auto w-full" />
				</Link>

				<div
					ref={notchRef}
					className="absolute left-1/2 top-0 w-[500px] -translate-x-1/2 text-[var(--notch)] xl:w-[600px]"
					style={{ filter: "drop-shadow(0 12px 20px rgba(0, 0, 0, 0.18))" }}
				>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="pointer-events-none absolute -left-[18px] top-0 z-10">
						<path d="M 20 20 L 20 0 L 0 0 C 11.046 0 20 11.046 20 20 Z" fill="currentColor" />
					</svg>
					<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="pointer-events-none absolute -right-[18px] top-0 z-10">
						<path d="M 0 0 L 20 0 C 8.954 0 0 8.954 0 20 Z" fill="currentColor" />
					</svg>

					<motion.div
						animate={{ height: activePanel ? 268 : 48 }}
						transition={{ type: "spring", stiffness: 300, damping: 28 }}
						className="relative flex w-full flex-col justify-start overflow-hidden bg-[var(--notch)]"
						style={{ borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px" }}
					>
						<div className="z-20 flex h-12 items-center justify-center px-6">
							<nav aria-label="Main" className="flex w-full items-center justify-center gap-1 text-sm font-medium xl:gap-4">
								{navItems.map((item) =>
									item.panelId ? (
										<button
											key={item.label}
											type="button"
											aria-expanded={activeMenu === item.panelId}
											aria-controls="nm-nav-panel"
											onClick={() => toggleMenu(item.panelId!)}
											className={`flex cursor-pointer items-center gap-1 rounded-md px-3 py-1.5 transition-colors hover:text-[var(--night-ink)] ${
												activeMenu === item.panelId ? "bg-[var(--night-raised)] text-[var(--night-ink)]" : "text-[var(--night-muted)]"
											}`}
										>
											{item.label}
											<ChevronDown
												className={`h-3.5 w-3.5 opacity-70 transition-transform duration-300 ${activeMenu === item.panelId ? "rotate-180" : ""}`}
											/>
										</button>
									) : (
									<HeaderLink
											key={item.label}
											href={item.href!}
											onClick={(event) => handleNavClick(event, item.href!)}
											className="px-2 py-1.5 text-[var(--night-muted)] transition-colors hover:text-[var(--night-ink)]"
										>
											{item.label}
									</HeaderLink>
									),
								)}
							</nav>
						</div>

						<AnimatePresence mode="wait">
							{activePanel && (
								<motion.div
									id="nm-nav-panel"
									key={activePanel.id}
									initial={{ opacity: 0, y: -8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -8 }}
									transition={{ duration: 0.18 }}
									className="overflow-hidden border-t border-[var(--night-line)]"
								>
									<DropdownPanel panel={activePanel} onPick={handleNavClick} />
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
				</div>

				<div className="flex items-center gap-3">
					<ThemeToggle />
					<Link href={`/signin${redirectQuery}`} className="nm-tlink py-2 text-sm font-medium">
						Sign in
					</Link>
					<Btn href={`/signup${redirectQuery}`} arrow className="!h-9 !gap-1.5 !px-3.5 !text-sm">
						Get started
					</Btn>
				</div>
			</div>

			{/* phone and tablet */}
			<div className="nm-wrap relative z-30 flex h-14 items-center justify-between lg:hidden">
				<Link href="/" aria-label="NextMilestone home" className="block w-[148px]">
					<Lockup className="block h-auto w-full" />
				</Link>
				<div className="flex items-center gap-2">
					<Btn href={`/signup${redirectQuery}`} className="!h-9 !px-3 !text-sm">
						Get started
					</Btn>
					<button
						type="button"
						aria-label={mobileOpen ? "Close menu" : "Open menu"}
						aria-expanded={mobileOpen}
						aria-controls="nm-mobile-menu"
						onClick={() => setMobileOpen((open) => !open)}
						className="grid size-11 place-items-center rounded-[var(--radius-control)] border border-[var(--line-control)] bg-[var(--surface)]"
					>
						{mobileOpen ? <X className="size-5" strokeWidth={1.75} /> : <Menu className="size-5" strokeWidth={1.75} />}
					</button>
				</div>
			</div>

			<AnimatePresence>
				{mobileOpen && (
					<motion.div
						id="nm-mobile-menu"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						className="relative z-20 mx-4 mb-3 overflow-hidden rounded-xl bg-[var(--notch)] text-[var(--night-ink)] shadow-[var(--shadow-float)] lg:hidden"
					>
						<div className="grid gap-1 p-3">
							{navItems.map((item) => {
								const panel = item.panelId ? getPanel(item.panelId) : null;
								const isOpen = mobileActiveMenu === item.panelId;

								if (!item.panelId) {
									return (
										<HeaderLink
											key={item.label}
											href={item.href!}
											onClick={(event) => handleNavClick(event, item.href!)}
											className="flex min-h-11 items-center rounded-lg px-3 text-base text-[var(--night-muted)] hover:bg-white/10 hover:text-[var(--night-ink)]"
										>
											{item.label}
										</HeaderLink>
									);
								}

								return (
									<div key={item.label}>
										<button
											type="button"
											aria-expanded={isOpen}
											onClick={() => setMobileActiveMenu(isOpen ? null : item.panelId!)}
											className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-base text-[var(--night-muted)] hover:bg-white/10 hover:text-[var(--night-ink)]"
										>
											{item.label}
											<ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
										</button>
										<AnimatePresence initial={false}>
											{isOpen && panel && (
												<motion.div
													initial={{ height: 0, opacity: 0 }}
													animate={{ height: "auto", opacity: 1 }}
													exit={{ height: 0, opacity: 0 }}
													transition={{ duration: 0.2 }}
													className="overflow-hidden"
												>
													<div className="mx-3 mb-2 grid gap-1 border-l border-white/10 pl-3 pt-1">
														{panel.items.map((panelItem) => (
														<HeaderLink
																key={panelItem.title}
																href={panelItem.href}
																onClick={(event) => handleNavClick(event, panelItem.href)}
																className="rounded-md px-3 py-2 hover:bg-white/5"
															>
																<span className="block text-[15px] font-medium text-[var(--night-ink)]">{panelItem.title}</span>
																{panelItem.description && (
																	<span className="mt-0.5 block text-[13px] leading-5 text-[var(--night-muted)]">{panelItem.description}</span>
																)}
														</HeaderLink>
														))}
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								);
							})}
							<div className="mt-1 flex items-center justify-between border-t border-white/10 px-3 pt-3">
								<Link href={`/signin${redirectQuery}`} onClick={closeAll} className="py-2 text-base font-medium text-[var(--night-ink)]">
									Sign in
								</Link>
								<span className="text-[var(--night-ink)]">
									<ThemeToggle />
								</span>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</header>
	);
}
