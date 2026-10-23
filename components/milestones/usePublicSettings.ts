"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicProfileSettings } from "@/lib/milestones/model";
import { fetchPublicSettings, savePublicSettingsRequest } from "./api";

/** Loads and saves the owner's public profile settings (including open_to_roles). */
export function usePublicSettings() {
	const [settings, setSettings] = useState<PublicProfileSettings | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		void fetchPublicSettings().then((result) => {
			if (result.ok) setSettings(result.data);
			else setLoadError(result.error);
		});
	}, []);

	/** Saves a change; returns an error message or null. */
	const save = useCallback(async (update: Partial<PublicProfileSettings>) => {
		const result = await savePublicSettingsRequest(update);
		if (!result.ok) return result.error;
		setSettings(result.data);
		return null;
	}, []);

	return { settings, loadError, save };
}
