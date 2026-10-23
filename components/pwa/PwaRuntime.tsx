"use client";

// Mounted once in the app shell: registers the service worker (production only), syncs the
// offline log outbox on `online`, and keeps the app icon badge at today's open plan items.

import { useEffect } from "react";
import { learnLogQueue } from "@/lib/pwa/logQueue";
import { refreshAppBadge, registerServiceWorker } from "@/lib/pwa/client";

const SW_ENABLED = process.env.NODE_ENV === "production";

function onVisible() {
	if (document.visibilityState === "visible") void refreshAppBadge();
}

export function PwaRuntime() {
	useEffect(() => {
		if (SW_ENABLED) void registerServiceWorker();
		const stopQueue = learnLogQueue.register();
		void refreshAppBadge();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			stopQueue();
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, []);
	return null;
}
