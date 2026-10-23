"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreateBlockInput, ExternalEvent, ScheduleBlock, UpdateBlockInput } from "@/lib/focus/schemas";
import { addDays } from "@/lib/focus/week";
import { createBlock, deleteBlock, fetchBlocks, fetchGoogleEvents, updateBlock } from "./api";

type GoogleState = Readonly<{ available: boolean; connected: boolean; error: string | null }>;

const NO_GOOGLE: GoogleState = { available: false, connected: false, error: null };

async function loadWeek(weekStart: Date) {
	const end = addDays(weekStart, 7);
	const [blocks, google] = await Promise.all([
		fetchBlocks(weekStart, end),
		fetchGoogleEvents(weekStart, end).catch(() => null),
	]);
	return { blocks, google };
}

export function useWeekSchedule(weekStart: Date) {
	const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
	const [events, setEvents] = useState<ExternalEvent[]>([]);
	const [google, setGoogle] = useState<GoogleState>(NO_GOOGLE);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const weekKey = weekStart.getTime();

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			const result = await loadWeek(new Date(weekKey));
			setBlocks(result.blocks);
			setEvents(result.google?.events ?? []);
			setGoogle(
				result.google
					? { available: result.google.available, connected: result.google.connected, error: result.google.error ?? null }
					: NO_GOOGLE
			);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load your schedule");
		} finally {
			setLoading(false);
		}
	}, [weekKey]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const create = useCallback(
		async (input: CreateBlockInput) => {
			await createBlock(input);
			await reload();
		},
		[reload]
	);

	const update = useCallback(
		async (id: string, input: UpdateBlockInput) => {
			await updateBlock(id, input);
			await reload();
		},
		[reload]
	);

	const remove = useCallback(async (id: string) => {
		await deleteBlock(id);
		setBlocks((current) => current.filter((block) => block.id !== id));
	}, []);

	return { blocks, events, google, loading, error, create, update, remove };
}
