/** The Learn page's tabs. No server imports. */
export const LEARN_TABS = ["log", "paths", "library"] as const;
export type LearnTab = (typeof LEARN_TABS)[number];

export function parseLearnTab(value: string | string[] | undefined): LearnTab {
	const raw = Array.isArray(value) ? value[0] : value;
	return LEARN_TABS.find((tab) => tab === raw) ?? "log";
}
