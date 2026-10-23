/* NextMilestone service worker (PRD area 8). Hand-written, no build step.
 *
 * Caching rules:
 * - Precache a small app shell: the offline page, icons and the manifest.
 * - Pages: network first. Only the static shells in SHELL_ROUTES (their HTML has no user
 *   data; data loads client-side) are kept for offline use; anything else falls back to
 *   /offline.
 * - /_next/static and /brand assets: cache first (file names are content-hashed / fixed).
 * - /api/* and every non-GET request: never cached.
 * Bump VERSION to drop old caches on activate.
 */

const VERSION = "v1";
const SHELL_CACHE = `nm-shell-${VERSION}`;
const STATIC_CACHE = `nm-static-${VERSION}`;
const PAGE_CACHE = `nm-pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/brand/icon-192.png", "/brand/icon-512.png", "/brand/favicon.svg"];
const SHELL_ROUTES = new Set(["/dashboard", "/focus"]);
const KEEP = new Set([SHELL_CACHE, STATIC_CACHE, PAGE_CACHE]);

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open(SHELL_CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((key) => key.startsWith("nm-") && !KEEP.has(key)).map((key) => caches.delete(key))))
			.then(() => self.clients.claim())
	);
});

function isStaticAsset(url) {
	return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/");
}

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;
	const response = await fetch(request);
	if (response.ok) {
		const cache = await caches.open(STATIC_CACHE);
		await cache.put(request, response.clone());
	}
	return response;
}

async function networkFirstPage(request, url) {
	try {
		const response = await fetch(request);
		if (response.ok && !response.redirected && SHELL_ROUTES.has(url.pathname)) {
			const cache = await caches.open(PAGE_CACHE);
			await cache.put(url.pathname, response.clone());
		}
		return response;
	} catch {
		const page = SHELL_ROUTES.has(url.pathname) ? await caches.match(url.pathname) : undefined;
		return page || (await caches.match(OFFLINE_URL)) || Response.error();
	}
}

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
	if (request.mode === "navigate") {
		event.respondWith(networkFirstPage(request, url));
		return;
	}
	if (isStaticAsset(url)) event.respondWith(cacheFirst(request));
});

// Signing out clears the page shells.
self.addEventListener("message", (event) => {
	if (event.data && event.data.type === "clear-pages") event.waitUntil(caches.delete(PAGE_CACHE));
});

// ==================== Push ====================

function safeHref(href) {
	if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) return "/dashboard";
	return href;
}

function readPayload(event) {
	try {
		return event.data ? event.data.json() : {};
	} catch {
		return { body: event.data ? event.data.text() : "" };
	}
}

async function showPush(data) {
	if (typeof data.badge === "number" && "setAppBadge" in self.navigator) {
		try {
			await (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
		} catch {
			// badges are optional
		}
	}
	await self.registration.showNotification(data.title || "NextMilestone", {
		body: data.body || "",
		icon: "/brand/icon-192.png",
		badge: "/brand/icon-192.png",
		tag: data.tag || "nextmilestone",
		data: { href: safeHref(data.href) },
	});
}

self.addEventListener("push", (event) => {
	event.waitUntil(showPush(readPayload(event)));
});

async function openHref(href) {
	const target = new URL(href, self.location.origin).href;
	const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
	for (const client of windows) {
		if (new URL(client.url).origin === self.location.origin && "focus" in client) {
			await client.focus();
			if ("navigate" in client) await client.navigate(target);
			return;
		}
	}
	await self.clients.openWindow(target);
}

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const href = safeHref(event.notification.data && event.notification.data.href);
	event.waitUntil(openHref(href));
});
