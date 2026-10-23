"use client";

// Settings → Data & privacy: "Public profile" (PRD area 7). The profile is off by default,
// and search indexing is a separate opt-in that is also off by default.

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	HANDLE_MAX,
	handleProblem,
	normalizeHandle,
	publicProfilePath,
	type PublicProfileSettings as Settings,
} from "@/lib/milestones/model";
import { Switch } from "./Switch";
import { usePublicSettings } from "./usePublicSettings";

type Save = (update: Partial<Settings>) => Promise<string | null>;

function Status({ error, saved }: Readonly<{ error: string | null; saved: boolean }>) {
	if (error) {
		return (
			<output aria-live="polite" className="block text-sm text-destructive">
				{error}
			</output>
		);
	}
	if (saved) {
		return (
			<output aria-live="polite" className="block text-sm text-[var(--success)]">
				Saved
			</output>
		);
	}
	return null;
}

function HandleForm({ settings, onSave }: Readonly<{ settings: Settings; onSave: Save }>) {
	const [handle, setHandle] = useState(settings.public_handle ?? "");
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => setHandle(settings.public_handle ?? ""), [settings.public_handle]);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaved(false);
		const next = normalizeHandle(handle);
		const problem = handleProblem(next);
		if (problem) {
			setError(problem);
			return;
		}
		setSaving(true);
		const failure = await onSave({ public_handle: next });
		setSaving(false);
		setError(failure);
		setSaved(failure === null);
	};

	return (
		<form onSubmit={(event) => void submit(event)} className="grid gap-1.5">
			<Label htmlFor="public-handle">Handle</Label>
			<div className="flex flex-col gap-2 sm:flex-row">
				<div className="flex min-w-0 flex-1 items-center gap-1">
					<span className="font-mono text-sm text-muted-foreground">/u/</span>
					<Input
						id="public-handle"
						autoComplete="off"
						spellCheck={false}
						maxLength={HANDLE_MAX}
						placeholder="jane-doe"
						aria-describedby="public-handle-hint"
						value={handle}
						onChange={(event) => setHandle(event.target.value)}
					/>
				</div>
				<Button type="submit" variant="outline" disabled={saving}>
					{saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					Save handle
				</Button>
			</div>
			<p id="public-handle-hint" className="text-xs text-muted-foreground">
				3 to 30 lowercase letters, numbers or hyphens.
			</p>
			<Status error={error} saved={saved} />
		</form>
	);
}

function ProfileLink({ settings }: Readonly<{ settings: Settings }>) {
	if (!settings.public_profile_enabled || !settings.public_handle) return null;
	const path = publicProfilePath(settings.public_handle);
	return (
		<p className="text-sm">
			Your profile is live at{" "}
			<Link href={path} className="font-mono underline underline-offset-2" target="_blank" rel="noopener">
				{path}
			</Link>
			.
		</p>
	);
}

function Toggles({ settings, onSave }: Readonly<{ settings: Settings; onSave: Save }>) {
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const save = async (update: Partial<Settings>) => {
		setSaving(true);
		setError(await onSave(update));
		setSaving(false);
	};

	return (
		<div className="grid gap-5">
			<Switch
				id="public-profile-enabled"
				label="Public profile"
				description="Show your name, headline and the milestones you mark public at your profile link. Off by default."
				checked={settings.public_profile_enabled}
				disabled={saving || !settings.public_handle}
				onChange={(value) => void save({ public_profile_enabled: value })}
			/>
			<Switch
				id="public-search-indexing"
				label="Let search engines index it"
				description="Off by default. When off, your profile asks search engines not to list it, so only people with the link find it."
				checked={settings.search_indexing}
				disabled={saving}
				onChange={(value) => void save({ search_indexing: value })}
			/>
			<Status error={error} saved={false} />
		</div>
	);
}

function SettingsBody({ settings, onSave }: Readonly<{ settings: Settings; onSave: Save }>) {
	return (
		<div className="grid gap-6">
			<HandleForm settings={settings} onSave={onSave} />
			<Toggles settings={settings} onSave={onSave} />
			<ProfileLink settings={settings} />
			<p className="text-sm text-muted-foreground">
				Your email and your &quot;Open to roles&quot; setting are never shown. Choose what&apos;s public, item by item, in{" "}
				<Link href="/profile/milestones" className="underline underline-offset-2">
					Milestones
				</Link>
				.
			</p>
		</div>
	);
}

export function PublicProfileSettings() {
	const { settings, loadError, save } = usePublicSettings();

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Globe className="h-5 w-5" aria-hidden="true" />
					Public profile
				</CardTitle>
				<CardDescription>A link you can share with your milestones on it. Private until you turn it on.</CardDescription>
			</CardHeader>
			<CardContent>
				<SettingsContent settings={settings} loadError={loadError} onSave={save} />
			</CardContent>
		</Card>
	);
}

function SettingsContent({
	settings,
	loadError,
	onSave,
}: Readonly<{ settings: Settings | null; loadError: string | null; onSave: Save }>) {
	if (loadError) return <p className="text-sm text-destructive">{loadError}</p>;
	if (!settings) {
		return (
			<p className="flex items-center gap-2 text-sm text-muted-foreground">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Loading
			</p>
		);
	}
	return <SettingsBody settings={settings} onSave={onSave} />;
}
