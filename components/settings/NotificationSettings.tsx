"use client";

// Settings → Notifications (PRD area 8). The install step comes first; "Turn on
// notifications" appears only where push can work (iOS from the Home Screen, 16.4+), and
// permission is requested only from that tap. Each notification type has its own switch.

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InstallCard } from "@/components/pwa/InstallCard";
import { pushReadiness, type PushReadiness } from "@/lib/pwa/platform";
import { disablePush, enablePush, existingSubscription, readEnvironment } from "@/lib/pwa/client";
import {
	DEFAULT_NOTIFICATION_PREFERENCES,
	type NotificationPreferenceKey,
	type NotificationPreferences,
} from "@/lib/pwa/schemas";

type Loaded = Readonly<{ preferences: NotificationPreferences; vapidPublicKey: string | null }>;

const PUSH_TOGGLES: ReadonlyArray<{ key: NotificationPreferenceKey; label: string; hint: string }> = [
	{ key: "morning_plan", label: "Morning plan", hint: "When today's plan is ready, around 6:30 AM your time." },
	{ key: "follow_ups", label: "Follow-ups due", hint: "When a follow-up you scheduled is due (8 AM–9 PM only)." },
	{ key: "interviews", label: "Interviews", hint: "Once, within 24 hours of an interview (8 AM–9 PM only)." },
];

const EMAIL_TOGGLE = {
	key: "email_fallback" as const,
	label: "Email my morning plan when push isn't set up",
	hint: "Sent only on days no device could get the push.",
};

async function loadSettings(): Promise<Loaded | null> {
	try {
		const response = await fetch("/api/push/preferences", { cache: "no-store" });
		if (!response.ok) return null;
		return (await response.json()) as Loaded;
	} catch {
		return null;
	}
}

async function savePreference(key: NotificationPreferenceKey, value: boolean): Promise<NotificationPreferences | null> {
	try {
		const response = await fetch("/api/push/preferences", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ [key]: value }),
		});
		if (!response.ok) return null;
		return ((await response.json()) as { preferences: NotificationPreferences }).preferences;
	} catch {
		return null;
	}
}

function Toggle({
	id,
	label,
	hint,
	checked,
	onChange,
}: Readonly<{ id: string; label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }>) {
	return (
		<label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
			<input
				id={id}
				type="checkbox"
				className="mt-1 h-5 w-5 accent-[var(--primary)]"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
			/>
			<span>
				<span className="block text-sm font-medium">{label}</span>
				<span className="block text-[13px] text-muted-foreground">{hint}</span>
			</span>
		</label>
	);
}

function readinessNote(readiness: PushReadiness) {
	if (readiness === "install_first") return "Add the app to your Home Screen first (steps above).";
	if (readiness === "unsupported") return "This browser can't receive push notifications. We'll email your morning plan instead.";
	return null;
}

function DeviceControl({ vapidPublicKey }: Readonly<{ vapidPublicKey: string }>) {
	const [readiness, setReadiness] = useState<PushReadiness>("unsupported");
	const [enabled, setEnabled] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		setReadiness(pushReadiness(readEnvironment(), true));
		void existingSubscription()
			.then((subscription) => setEnabled(subscription !== null && Notification.permission === "granted"))
			.catch(() => setEnabled(false));
	}, []);

	const turnOn = async () => {
		setBusy(true);
		setMessage(null);
		const result = await enablePush(vapidPublicKey).catch(() => "failed" as const);
		setEnabled(result === "enabled");
		if (result === "denied") setMessage("Notifications are blocked. You can allow them in your browser or phone settings.");
		if (result === "failed") setMessage("Could not turn on notifications. Please try again.");
		setBusy(false);
	};

	const turnOff = async () => {
		setBusy(true);
		const ok = await disablePush().catch(() => false);
		setEnabled(!ok);
		setBusy(false);
	};

	const note = readinessNote(readiness);
	if (note) return <p className="text-sm text-muted-foreground">{note}</p>;
	return (
		<div className="space-y-2">
			{enabled ? (
				<Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void turnOff()}>
					<BellOff className="h-4 w-4" aria-hidden="true" />
					Turn off on this device
				</Button>
			) : (
				<Button type="button" className="min-h-11" disabled={busy} onClick={() => void turnOn()}>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
					Turn on notifications
				</Button>
			)}
			{message && (
				<output aria-live="polite" className="block text-sm text-destructive">
					{message}
				</output>
			)}
		</div>
	);
}

function usePreferences() {
	const [loaded, setLoaded] = useState<Loaded | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void loadSettings().then((data) => {
			if (data) setLoaded(data);
			else setError("Could not load notification settings.");
		});
	}, []);

	const update = useCallback(async (key: NotificationPreferenceKey, value: boolean) => {
		setLoaded((current) => current && { ...current, preferences: { ...current.preferences, [key]: value } });
		const saved = await savePreference(key, value);
		if (saved) {
			setError(null);
			setLoaded((current) => current && { ...current, preferences: saved });
		} else {
			setError("Could not save that change. Please try again.");
			setLoaded((current) => current && { ...current, preferences: { ...current.preferences, [key]: !value } });
		}
	}, []);

	return { loaded, error, update };
}

export function NotificationSettings() {
	const { loaded, error, update } = usePreferences();
	const preferences = loaded?.preferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
	const vapidPublicKey = loaded?.vapidPublicKey ?? null;

	return (
		<div className="grid gap-6">
			{vapidPublicKey && <InstallCard />}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-lg">
						<Bell className="h-5 w-5" aria-hidden="true" />
						Notifications
					</CardTitle>
					<CardDescription>Only what helps you take the next step. Turn any of them off at any time.</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-5">
					{vapidPublicKey && <DeviceControl vapidPublicKey={vapidPublicKey} />}
					<fieldset className="grid gap-1" disabled={!loaded}>
						<legend className="mb-1 text-sm font-semibold">What to send</legend>
						{vapidPublicKey &&
							PUSH_TOGGLES.map((toggle) => (
								<Toggle
									key={toggle.key}
									id={`notify-${toggle.key}`}
									label={toggle.label}
									hint={toggle.hint}
									checked={preferences[toggle.key]}
									onChange={(value) => void update(toggle.key, value)}
								/>
							))}
						<Toggle
							id="notify-email-fallback"
							label={EMAIL_TOGGLE.label}
							hint={EMAIL_TOGGLE.hint}
							checked={preferences.email_fallback}
							onChange={(value) => void update(EMAIL_TOGGLE.key, value)}
						/>
					</fieldset>
					{error && (
						<output aria-live="polite" className="block text-sm text-destructive">
							{error}
						</output>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
