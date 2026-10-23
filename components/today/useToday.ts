"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlanItem } from "@/lib/today/nextStep";
import type { TodayData, TodayPlan } from "@/lib/today/types";

type PlanResponse = { plan?: TodayPlan & { nextStepDismissed?: boolean }; error?: string };

async function fetchToday(): Promise<TodayData> {
	const res = await fetch("/api/today", { cache: "no-store" });
	if (!res.ok) throw new Error("Could not load Today");
	return (await res.json()) as TodayData;
}

async function sendPlanRequest(method: "PATCH" | "POST", body?: unknown): Promise<PlanResponse> {
	const res = await fetch("/api/today/plan", {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const json = (await res.json().catch(() => ({}))) as PlanResponse;
	if (!res.ok) throw new Error(json.error ?? "Could not update your plan");
	return json;
}

function withItems(data: TodayData, items: PlanItem[]): TodayData {
	if (!data.plan) return data;
	return { ...data, plan: { ...data.plan, items } };
}

function withPlan(data: TodayData, plan: TodayPlan | undefined): TodayData {
	if (!plan) return data;
	return { ...data, plan: { date: plan.date, items: plan.items, generatedAt: plan.generatedAt } };
}

function setDone(items: readonly PlanItem[], id: string, done: boolean): PlanItem[] {
	return items.map((i) => (i.id === id ? { ...i, done } : i));
}

export type TodayState = Readonly<{
	data: TodayData | null;
	loading: boolean;
	error: string | null;
	actionError: string | null;
	regenerating: boolean;
	toggleItem: (id: string, done: boolean) => Promise<void>;
	dismissNextStep: () => Promise<void>;
	regenerate: () => Promise<void>;
	reload: () => Promise<void>;
}>;

export function useToday(): TodayState {
	const [data, setData] = useState<TodayData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [regenerating, setRegenerating] = useState(false);

	const reload = useCallback(async () => {
		setLoading(true);
		try {
			setData(await fetchToday());
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not load Today");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const toggleItem = useCallback(async (id: string, done: boolean) => {
		setActionError(null);
		setData((d) => (d?.plan ? withItems(d, setDone(d.plan.items, id, done)) : d));
		try {
			await sendPlanRequest("PATCH", { action: "toggle", itemId: id, done });
		} catch (e) {
			setData((d) => (d?.plan ? withItems(d, setDone(d.plan.items, id, !done)) : d));
			setActionError(e instanceof Error ? e.message : "Could not update your plan");
		}
	}, []);

	const dismissNextStep = useCallback(async () => {
		setActionError(null);
		setData((d) => (d ? { ...d, nextStepDismissed: true } : d));
		try {
			await sendPlanRequest("PATCH", { action: "dismiss_next_step" });
		} catch (e) {
			setData((d) => (d ? { ...d, nextStepDismissed: false } : d));
			setActionError(e instanceof Error ? e.message : "Could not update your plan");
		}
	}, []);

	const regenerate = useCallback(async () => {
		setActionError(null);
		setRegenerating(true);
		try {
			const res = await sendPlanRequest("POST");
			setData((d) => (d ? withPlan(d, res.plan) : d));
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "Could not regenerate your plan");
		} finally {
			setRegenerating(false);
		}
	}, []);

	return { data, loading, error, actionError, regenerating, toggleItem, dismissNextStep, regenerate, reload };
}
