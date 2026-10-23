import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { EXPORT_TABLES } from "@/lib/account/export";
import { TASK_TYPES } from "@/lib/taskTypes";
import {
	base64UrlToUint8Array,
	detectPlatform,
	iosVersion,
	isIosDevice,
	openPlanCount,
	pushOptOutRate,
	pushReadiness,
	safeNotificationHref,
	type EnvironmentInfo,
} from "@/lib/pwa/platform";
import {
	notificationPreferencesSchema,
	parseQueuedLogEntry,
	pushSubscriptionSchema,
	withPreferenceDefaults,
} from "@/lib/pwa/schemas";

const IPHONE_SAFARI =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_OLD = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

function env(overrides: Partial<EnvironmentInfo>): EnvironmentInfo {
	return {
		userAgent: ANDROID,
		maxTouchPoints: 5,
		standalone: false,
		hasServiceWorker: true,
		hasPushManager: true,
		hasNotification: true,
		...overrides,
	};
}

describe("platform detection", () => {
	it("detects iOS, including iPadOS asking for the desktop site", () => {
		expect(isIosDevice(IPHONE_SAFARI)).toBe(true);
		expect(isIosDevice(IPAD_DESKTOP, 5)).toBe(true);
		expect(isIosDevice(IPAD_DESKTOP, 0)).toBe(false);
		expect(detectPlatform(IPHONE_SAFARI)).toBe("ios");
		expect(detectPlatform(ANDROID)).toBe("android");
		expect(detectPlatform(WINDOWS)).toBe("desktop");
		expect(detectPlatform("curl/8.0")).toBe("other");
	});

	it("reads the iOS version", () => {
		expect(iosVersion(IPHONE_SAFARI)).toBeCloseTo(17.04);
		expect(iosVersion(IPHONE_OLD)).toBeCloseTo(16.03);
		expect(iosVersion(ANDROID)).toBeNull();
	});
});

describe("push readiness (install step before permission)", () => {
	it("hides push when the server has no VAPID keys", () => {
		expect(pushReadiness(env({}), false)).toBe("unconfigured");
	});

	it("asks iOS Safari users to add the app to the Home Screen first", () => {
		expect(pushReadiness(env({ userAgent: IPHONE_SAFARI, standalone: false }), true)).toBe("install_first");
	});

	it("offers push on iOS 16.4+ from the Home Screen only", () => {
		expect(pushReadiness(env({ userAgent: IPHONE_SAFARI, standalone: true }), true)).toBe("ready");
		expect(pushReadiness(env({ userAgent: IPHONE_OLD, standalone: true }), true)).toBe("unsupported");
	});

	it("offers push on Android and desktop browsers with the Push API", () => {
		expect(pushReadiness(env({}), true)).toBe("ready");
		expect(pushReadiness(env({ userAgent: WINDOWS, maxTouchPoints: 0 }), true)).toBe("ready");
		expect(pushReadiness(env({ hasPushManager: false }), true)).toBe("unsupported");
	});
});

describe("helpers", () => {
	it("decodes a base64url VAPID key", () => {
		expect(Array.from(base64UrlToUint8Array("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
	});

	it("counts open plan items for the badge", () => {
		expect(openPlanCount([{ done: false }, { done: true }, {}])).toBe(2);
		expect(openPlanCount(null)).toBe(0);
	});

	it("keeps notification links on this site", () => {
		expect(safeNotificationHref("/companies/1")).toBe("/companies/1");
		expect(safeNotificationHref("https://evil.example")).toBe("/dashboard");
		expect(safeNotificationHref("//evil.example")).toBe("/dashboard");
		expect(safeNotificationHref("/\\evil.example")).toBe("/dashboard");
		expect(safeNotificationHref(42)).toBe("/dashboard");
	});

	it("computes opt-out per platform", () => {
		expect(pushOptOutRate({ subscribed: 8, unsubscribed: 1, denied: 2 })).toBe(30);
		expect(pushOptOutRate({ subscribed: 0, unsubscribed: 0, denied: 0 })).toBeNull();
	});
});

describe("schemas", () => {
	const subscription = {
		endpoint: "https://fcm.googleapis.com/fcm/send/abc",
		keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
		platform: "android",
	};

	it("accepts a browser push subscription and rejects non-https endpoints", () => {
		expect(pushSubscriptionSchema.safeParse(subscription).success).toBe(true);
		expect(pushSubscriptionSchema.safeParse({ ...subscription, endpoint: "http://push.example/x" }).success).toBe(false);
		expect(pushSubscriptionSchema.safeParse({ ...subscription, platform: "windows" }).success).toBe(false);
	});

	it("validates preference updates and fills defaults", () => {
		expect(notificationPreferencesSchema.safeParse({ follow_ups: false }).success).toBe(true);
		expect(notificationPreferencesSchema.safeParse({}).success).toBe(false);
		expect(notificationPreferencesSchema.safeParse({ marketing: true }).success).toBe(false);
		expect(withPreferenceDefaults(null)).toEqual({ morning_plan: true, follow_ups: true, interviews: true, email_fallback: true });
		expect(withPreferenceDefaults({ interviews: false }).interviews).toBe(false);
	});

	it("parses queued log entries with a client id", () => {
		const id = "6f1c2b9e-8a39-4c55-9a59-2c3d1b7e4f10";
		expect(parseQueuedLogEntry({ client_id: id, kind: "note", note: "Learned about indexes" })).toEqual({
			client_id: id,
			kind: "note",
			note: "Learned about indexes",
		});
		expect(parseQueuedLogEntry({ client_id: id, kind: "link", url: "javascript:alert(1)" })).toBeNull();
		expect(parseQueuedLogEntry({ client_id: "nope", kind: "note", note: "x" })).toBeNull();
		expect(parseQueuedLogEntry({ client_id: id, kind: "note", note: "x", extra: 1 })).toBeNull();
		expect(parseQueuedLogEntry([1])).toBeNull();
	});
});

describe("install surface", () => {
	it("has a complete web manifest", () => {
		const m = manifest();
		expect(m.display).toBe("standalone");
		expect(m.start_url).toBe("/dashboard");
		expect(m.scope).toBe("/");
		expect(m.icons?.some((icon) => icon.purpose === "maskable")).toBe(true);
		expect(m.shortcuts?.map((s) => s.short_name)).toEqual(["Today", "Log", "Focus"]);
	});

	it("ships a service worker that never caches the API and handles push clicks", () => {
		const sw = readFileSync("public/sw.js", "utf8");
		expect(sw).toContain('url.pathname.startsWith("/api/")');
		expect(sw).toContain('addEventListener("push"');
		expect(sw).toContain('addEventListener("notificationclick"');
		expect(sw).toContain("const VERSION =");
	});

	it("exports the new tables without device secrets and registers the task type", () => {
		const tables = EXPORT_TABLES.map((t) => t.table);
		expect(tables).toEqual(expect.arrayContaining(["push_subscriptions", "notification_preferences", "push_events"]));
		expect(EXPORT_TABLES.find((t) => t.table === "push_subscriptions")?.omit).toEqual(["p256dh", "auth"]);
		expect(TASK_TYPES).toContain("push_reminders");
	});

	it("adds the migration with RLS on every new table", () => {
		const sql = readFileSync("supabase/migrations/20261024001200_pwa_push.sql", "utf8");
		for (const table of ["push_subscriptions", "notification_preferences", "push_events", "notification_deliveries"]) {
			expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
		}
		expect(sql).toContain("SELECT public.extend_task_types(ARRAY['push_reminders'])");
	});
});
