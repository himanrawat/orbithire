// Browser-only PWA helpers: service worker, app badge and push subscription. Every API is
// feature-detected; callers in unsupported browsers get a quiet no-op.

import { base64UrlToUint8Array, detectPlatform, type EnvironmentInfo, type PushPlatform } from "./platform";

export function readEnvironment(): EnvironmentInfo {
	const nav = navigator as Navigator & { standalone?: boolean };
	return {
		userAgent: nav.userAgent,
		maxTouchPoints: nav.maxTouchPoints ?? 0,
		standalone: window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true,
		hasServiceWorker: "serviceWorker" in nav,
		hasPushManager: "PushManager" in window,
		hasNotification: "Notification" in window,
	};
}

export function currentPlatform(): PushPlatform {
	return detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

export async function registerServiceWorker(): Promise<void> {
	if (!("serviceWorker" in navigator)) return;
	try {
		await navigator.serviceWorker.register("/sw.js", { scope: "/" });
	} catch (error) {
		console.warn("Service worker registration failed", error);
	}
}

/** Drops the cached page shells (called on sign-out). */
export function clearOfflinePages(): void {
	if (!("serviceWorker" in navigator)) return;
	navigator.serviceWorker.controller?.postMessage({ type: "clear-pages" });
}

type BadgeNavigator = Navigator & {
	setAppBadge?: (count?: number) => Promise<void>;
	clearAppBadge?: () => Promise<void>;
};

export async function setAppBadge(count: number): Promise<void> {
	const nav = navigator as BadgeNavigator;
	if (!nav.setAppBadge || !nav.clearAppBadge) return;
	try {
		await (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge());
	} catch {
		// Not allowed in this context (e.g. not installed): badges are optional.
	}
}

export async function refreshAppBadge(): Promise<void> {
	if (!("setAppBadge" in navigator)) return;
	try {
		const response = await fetch("/api/today/badge", { cache: "no-store" });
		if (!response.ok) return;
		const body = (await response.json()) as { count?: unknown };
		await setAppBadge(typeof body.count === "number" ? body.count : 0);
	} catch {
		// offline: keep the last badge
	}
}

async function postJson(url: string, method: "POST" | "DELETE", body: unknown): Promise<boolean> {
	const response = await fetch(url, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return response.ok;
}

export async function existingSubscription(): Promise<PushSubscription | null> {
	if (!("serviceWorker" in navigator)) return null;
	const registration = await navigator.serviceWorker.getRegistration();
	return (await registration?.pushManager.getSubscription()) ?? null;
}

export type EnableResult = "enabled" | "denied" | "failed";

/** Must run from a user tap: asks permission, subscribes and saves the subscription. */
export async function enablePush(vapidPublicKey: string): Promise<EnableResult> {
	const platform = currentPlatform();
	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		if (permission === "denied") await postJson("/api/push/events", "POST", { platform, event: "denied" });
		return "denied";
	}
	await registerServiceWorker();
	const registration = await navigator.serviceWorker.ready;
	const subscription =
		(await registration.pushManager.getSubscription()) ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: base64UrlToUint8Array(vapidPublicKey),
		}));
	const json = subscription.toJSON();
	const ok = await postJson("/api/push/subscription", "POST", {
		endpoint: json.endpoint,
		keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
		platform,
	});
	return ok ? "enabled" : "failed";
}

export async function disablePush(): Promise<boolean> {
	const subscription = await existingSubscription();
	if (!subscription) return true;
	const ok = await postJson("/api/push/subscription", "DELETE", {
		endpoint: subscription.endpoint,
		platform: currentPlatform(),
	});
	await subscription.unsubscribe();
	return ok;
}
