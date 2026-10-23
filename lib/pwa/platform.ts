/**
 * PWA platform helpers (PRD area 8). Pure: every browser value is passed in, so the rules
 * are unit tested. No server imports.
 *
 * iOS web push works only from a Home Screen app (iOS/iPadOS 16.4+), and the permission
 * request must follow a tap (https://webkit.org/blog/13878/). So on iOS Safari outside
 * standalone mode we show "Add to Home Screen" steps and never offer notifications.
 */

export const PUSH_PLATFORMS = ["ios", "android", "desktop", "other"] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export type EnvironmentInfo = Readonly<{
	userAgent: string;
	/** navigator.maxTouchPoints (iPadOS 13+ reports a Mac user agent) */
	maxTouchPoints: number;
	/** display-mode: standalone, or navigator.standalone on iOS */
	standalone: boolean;
	hasServiceWorker: boolean;
	hasPushManager: boolean;
	hasNotification: boolean;
}>;

export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
	if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
	// iPadOS asks for the desktop site and reports "Macintosh"; touch gives it away.
	return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function detectPlatform(userAgent: string, maxTouchPoints = 0): PushPlatform {
	if (isIosDevice(userAgent, maxTouchPoints)) return "ios";
	if (/Android/i.test(userAgent)) return "android";
	if (/Windows|Macintosh|Linux|CrOS/i.test(userAgent)) return "desktop";
	return "other";
}

/** iOS major.minor from the user agent ("OS 17_4" or "Version/17.4"), or null. */
export function iosVersion(userAgent: string): number | null {
	const match = /OS (\d+)[._](\d+)/.exec(userAgent) ?? /Version\/(\d+)\.(\d+)/.exec(userAgent);
	if (!match) return null;
	return Number(match[1]) + Number(match[2]) / 100;
}

export type PushReadiness =
	/** VAPID keys missing on the server: hide everything push-related */
	| "unconfigured"
	/** iOS in a Safari tab: show Add to Home Screen steps first */
	| "install_first"
	/** iOS older than 16.4, or a browser without the Push API */
	| "unsupported"
	/** can ask for permission from a tap */
	| "ready";

export function pushReadiness(env: EnvironmentInfo, configured: boolean): PushReadiness {
	if (!configured) return "unconfigured";
	const ios = isIosDevice(env.userAgent, env.maxTouchPoints);
	if (ios && !env.standalone) return "install_first";
	if (ios) {
		const version = iosVersion(env.userAgent);
		if (version !== null && version < 16.04) return "unsupported";
	}
	if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return "unsupported";
	return "ready";
}

/** VAPID public key (base64url) → the Uint8Array PushManager.subscribe expects. */
export function base64UrlToUint8Array(value: string): Uint8Array {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

/** Number of plan items not checked off (the app icon badge). */
export function openPlanCount(items: ReadonlyArray<{ done?: unknown }> | null | undefined): number {
	return (items ?? []).filter((item) => item.done !== true).length;
}

/** Same-origin paths only: a push payload can never send the app to another site. */
export function safeNotificationHref(href: unknown): string {
	if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) {
		return "/dashboard";
	}
	return href;
}

/**
 * Push opt-out per platform, in percent: (turned off + declined) / (turned on + declined).
 * Null when nobody on that platform was asked yet.
 */
export function pushOptOutRate(counts: Readonly<{ subscribed: number; unsubscribed: number; denied: number }>): number | null {
	const asked = Number(counts.subscribed) + Number(counts.denied);
	if (asked === 0) return null;
	return Math.round(((Number(counts.unsubscribed) + Number(counts.denied)) / asked) * 100);
}
