"use client";

import { useCallback, useEffect, useState } from "react";
import { sortByDateDesc, type Milestone, type MilestoneSuggestion, type SuggestionAction } from "@/lib/milestones/model";
import {
	actOnSuggestion,
	createMilestoneRequest,
	deleteMilestoneRequest,
	fetchMilestones,
	fetchSuggestions,
	updateMilestoneRequest,
	type MilestoneInput,
} from "./api";

/** The owner's timeline and suggestions, with add / edit / delete / accept / dismiss. */
export function useMilestones() {
	const [milestones, setMilestones] = useState<Milestone[]>([]);
	const [suggestions, setSuggestions] = useState<MilestoneSuggestion[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		void Promise.all([fetchMilestones(), fetchSuggestions()]).then(([list, pending]) => {
			if (list.ok) setMilestones(list.data);
			else setLoadError(list.error);
			if (pending.ok) setSuggestions(pending.data);
			setLoading(false);
		});
	}, []);

	const add = useCallback(async (input: MilestoneInput) => {
		const result = await createMilestoneRequest(input);
		if (!result.ok) return result.error;
		setMilestones((current) => sortByDateDesc([result.data, ...current]));
		return null;
	}, []);

	const update = useCallback(async (id: string, input: Partial<MilestoneInput>) => {
		const result = await updateMilestoneRequest(id, input);
		if (!result.ok) return result.error;
		setMilestones((current) => sortByDateDesc(current.map((m) => (m.id === id ? result.data : m))));
		return null;
	}, []);

	const remove = useCallback(async (id: string) => {
		const result = await deleteMilestoneRequest(id);
		if (!result.ok) return result.error;
		setMilestones((current) => current.filter((m) => m.id !== id));
		return null;
	}, []);

	const actOn = useCallback(async (id: string, action: SuggestionAction) => {
		const result = await actOnSuggestion(id, action);
		if (!result.ok) return result.error;
		setSuggestions((current) => current.filter((s) => s.id !== id));
		const added = result.data;
		if (added) setMilestones((current) => sortByDateDesc([added, ...current]));
		return null;
	}, []);

	return { milestones, suggestions, loading, loadError, add, update, remove, actOn };
}
