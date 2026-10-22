"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type SharedProfile = Record<string, any> & {
	full_name?: string | null;
	email?: string | null;
	avatar_url?: string | null;
	skills?: string[] | null;
};

type ProfileContextValue = {
	profile: SharedProfile | null;
	loading: boolean;
	refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileDataProvider({ children }: Readonly<{ children: React.ReactNode }>) {
	const [profile, setProfile] = useState<SharedProfile | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const response = await fetch("/api/profile", { cache: "no-store" });
			if (!response.ok) return;
			const data = await response.json();
			setProfile(data.profile ?? null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
		const handleUpdate = () => void refresh();
		window.addEventListener("profile:updated", handleUpdate);
		return () => window.removeEventListener("profile:updated", handleUpdate);
	}, [refresh]);

	const value = useMemo(() => ({ profile, loading, refresh }), [profile, loading, refresh]);
	return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfileData() {
	const value = useContext(ProfileContext);
	if (!value) throw new Error("useProfileData must be used within ProfileDataProvider");
	return value;
}
