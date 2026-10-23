"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicProfileSettings } from "@/lib/milestones/model";
import { Switch } from "./Switch";

/** "Open to roles": a private note to yourself. Never shown on the public profile. */
export function OpenToRolesCard({
	settings,
	onSave,
}: Readonly<{
	settings: PublicProfileSettings;
	onSave: (update: Partial<PublicProfileSettings>) => Promise<string | null>;
}>) {
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const toggle = async (value: boolean) => {
		setSaving(true);
		setError(await onSave({ open_to_roles: value }));
		setSaving(false);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Lock className="h-5 w-5" aria-hidden="true" />
					Open to roles
				</CardTitle>
				<CardDescription>Only you can see this.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				<Switch
					id="open-to-roles"
					label="I'm open to new roles"
					description="A private note for yourself. It is never shown on your public profile, to other members or to recruiters."
					checked={settings.open_to_roles}
					disabled={saving}
					onChange={(value) => void toggle(value)}
				/>
				{error && (
					<output aria-live="polite" className="block text-sm text-destructive">
						{error}
					</output>
				)}
			</CardContent>
		</Card>
	);
}
