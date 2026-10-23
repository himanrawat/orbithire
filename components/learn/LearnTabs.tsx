"use client";

// Log / Paths / Library tabs. Panels are rendered on the server and passed in; the tab
// in the URL (?tab=paths) is kept in sync so a tab can be linked and survives reload.

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { BookOpen, Library, NotebookPen } from "lucide-react";
import { tabClass, tabListClass } from "@/components/app/blocks";
import { LEARN_TABS, type LearnTab } from "@/lib/learn/tabs";

const TAB_META: Readonly<Record<LearnTab, { label: string; icon: ReactNode }>> = {
	log: { label: "Log", icon: <NotebookPen className="h-4 w-4" aria-hidden="true" /> },
	paths: { label: "Paths", icon: <BookOpen className="h-4 w-4" aria-hidden="true" /> },
	library: { label: "Library", icon: <Library className="h-4 w-4" aria-hidden="true" /> },
};

function syncUrl(tab: LearnTab) {
	const url = new URL(window.location.href);
	if (tab === "log") url.searchParams.delete("tab");
	else url.searchParams.set("tab", tab);
	window.history.replaceState(null, "", url);
}

function focusTab(tab: LearnTab) {
	document.getElementById(`learn-tab-${tab}`)?.focus();
}

function nextTab(current: LearnTab, key: string): LearnTab | null {
	const index = LEARN_TABS.indexOf(current);
	if (key === "ArrowRight") return LEARN_TABS[(index + 1) % LEARN_TABS.length];
	if (key === "ArrowLeft") return LEARN_TABS[(index - 1 + LEARN_TABS.length) % LEARN_TABS.length];
	if (key === "Home") return LEARN_TABS[0];
	if (key === "End") return LEARN_TABS[LEARN_TABS.length - 1];
	return null;
}

export function LearnTabs({
	initialTab,
	panels,
}: Readonly<{ initialTab: LearnTab; panels: Readonly<Record<LearnTab, ReactNode>> }>) {
	const [active, setActive] = useState<LearnTab>(initialTab);

	const select = (tab: LearnTab) => {
		setActive(tab);
		syncUrl(tab);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const tab = nextTab(active, event.key);
		if (!tab) return;
		event.preventDefault();
		select(tab);
		focusTab(tab);
	};

	return (
		<div>
			<div role="tablist" aria-label="Learn sections" className={`${tabListClass} mb-6 w-fit`} onKeyDown={onKeyDown}>
				{LEARN_TABS.map((tab) => (
					<button
						key={tab}
						id={`learn-tab-${tab}`}
						type="button"
						role="tab"
						aria-selected={active === tab}
						aria-controls={`learn-panel-${tab}`}
						tabIndex={active === tab ? 0 : -1}
						className={tabClass(active === tab)}
						onClick={() => select(tab)}
					>
						{TAB_META[tab].icon}
						{TAB_META[tab].label}
					</button>
				))}
			</div>
			{LEARN_TABS.map((tab) => (
				<div
					key={tab}
					id={`learn-panel-${tab}`}
					role="tabpanel"
					aria-labelledby={`learn-tab-${tab}`}
					hidden={active !== tab}
				>
					{panels[tab]}
				</div>
			))}
		</div>
	);
}
