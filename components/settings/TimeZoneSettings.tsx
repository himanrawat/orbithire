"use client";

// Settings → Account: "Time zone" (profiles.timezone). Today's plan is built at 6:30 AM here.

import { useEffect, useId, useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { nativeSelectClass } from "@/components/app/blocks";
import { fetchOnboarding, saveOnboarding } from "@/components/onboarding/api";
import { DEFAULT_PROFILE_TIME_ZONE, canonicalTimeZone, timeZoneOptions } from "@/lib/timeZones";

type SaveState = { status: "idle" } | { status: "saving" } | { status: "saved" } | { status: "error"; message: string };

function deviceTimeZone(): string | null {
	try {
		return canonicalTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
	} catch {
		return null;
	}
}

function SaveStatus({ state }: Readonly<{ state: SaveState }>) {
	if (state.status === "saved") {
		return (
			<output aria-live="polite" className="flex items-center gap-2 text-sm">
				<CheckCircle2 className="h-4 w-4 text-[var(--success)]" aria-hidden="true" />
				Saved
			</output>
		);
	}
	if (state.status === "error") {
		return (
			<output aria-live="polite" className="block text-sm text-destructive">
				{state.message}
			</output>
		);
	}
	return null;
}

export function TimeZoneSettings() {
	const selectId = useId();
	const [zone, setZone] = useState(DEFAULT_PROFILE_TIME_ZONE);
	const [device, setDevice] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [state, setState] = useState<SaveState>({ status: "idle" });
	const options = useMemo(() => timeZoneOptions(zone), [zone]);

	useEffect(() => {
		setDevice(deviceTimeZone());
		void fetchOnboarding().then((profile) => {
			if (profile?.timezone) setZone(profile.timezone);
			setLoading(false);
		});
	}, []);

	const save = async (value: string) => {
		setState({ status: "saving" });
		const failure = await saveOnboarding({ timezone: value });
		setState(failure ? { status: "error", message: failure } : { status: "saved" });
	};

	const applyDeviceZone = () => {
		if (!device) return;
		setZone(device);
		void save(device);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Clock className="h-5 w-5" aria-hidden="true" />
					Time zone
				</CardTitle>
				<CardDescription>Your daily plan is ready at 6:30 AM in this time zone.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-1.5">
					<Label htmlFor={selectId}>Time zone</Label>
					<select
						id={selectId}
						value={zone}
						disabled={loading}
						onChange={(event) => setZone(event.target.value)}
						className={nativeSelectClass}
					>
						{options.map((option) => (
							<option key={option} value={option}>
								{option.replaceAll("_", " ")}
							</option>
						))}
					</select>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<Button type="button" onClick={() => void save(zone)} disabled={loading || state.status === "saving"}>
						{state.status === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
						Save time zone
					</Button>
					{device && device !== zone && (
						<Button type="button" variant="outline" onClick={applyDeviceZone} disabled={loading || state.status === "saving"}>
							Use this device&apos;s zone ({device.replaceAll("_", " ")})
						</Button>
					)}
					<SaveStatus state={state} />
				</div>
			</CardContent>
		</Card>
	);
}
