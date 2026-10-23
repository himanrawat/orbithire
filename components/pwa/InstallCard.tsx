"use client";

// Install step (PRD area 8). iOS Safari has no install prompt and allows web push only from
// the Home Screen, so it gets "Add to Home Screen" steps; Chrome/Edge (Android, desktop)
// get an Install button from `beforeinstallprompt`. Hidden once the app runs installed.

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isIosDevice } from "@/lib/pwa/platform";
import { readEnvironment } from "@/lib/pwa/client";

type InstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "hidden" | "ios" | "prompt";

function useInstallMode() {
	const [mode, setMode] = useState<Mode>("hidden");
	const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

	useEffect(() => {
		const env = readEnvironment();
		if (env.standalone) return;
		if (isIosDevice(env.userAgent, env.maxTouchPoints)) setMode("ios");
		const onPrompt = (event: Event) => {
			event.preventDefault();
			setDeferred(event as InstallPromptEvent);
			setMode("prompt");
		};
		const onInstalled = () => setMode("hidden");
		window.addEventListener("beforeinstallprompt", onPrompt);
		window.addEventListener("appinstalled", onInstalled);
		return () => {
			window.removeEventListener("beforeinstallprompt", onPrompt);
			window.removeEventListener("appinstalled", onInstalled);
		};
	}, []);

	const install = async () => {
		if (!deferred) return;
		try {
			await deferred.prompt();
			const choice = await deferred.userChoice;
			if (choice.outcome === "accepted") setMode("hidden");
		} catch {
			// The prompt can be used once; a stale event just does nothing.
		}
		setDeferred(null);
	};

	return { mode, install };
}

function IosSteps() {
	return (
		<ol className="list-decimal space-y-2 pl-5 text-sm">
			<li>
				In Safari, tap <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> Share.
			</li>
			<li>
				Choose <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" /> &ldquo;Add to Home
				Screen&rdquo;, then Add.
			</li>
			<li>Open NextMilestone from your Home Screen and come back here to turn on notifications.</li>
		</ol>
	);
}

export function InstallCard() {
	const { mode, install } = useInstallMode();
	if (mode === "hidden") return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Download className="h-5 w-5" aria-hidden="true" />
					Add NextMilestone to your phone
				</CardTitle>
				<CardDescription>
					{mode === "ios"
						? "On iPhone and iPad, notifications work once the app is on your Home Screen (iOS 16.4 or later)."
						: "Install the app for a full-screen Today, quick logging and a timer that works offline."}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{mode === "ios" ? (
					<IosSteps />
				) : (
					<Button type="button" className="min-h-11" onClick={() => void install()}>
						<Download className="h-4 w-4" aria-hidden="true" />
						Install app
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
