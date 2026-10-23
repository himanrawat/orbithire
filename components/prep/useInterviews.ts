"use client";

import { useCallback, useEffect, useState } from "react";
import type { InterviewCard } from "@/lib/prep/constants";
import { toggleChecklistItem } from "@/lib/prep/interviews";
import {
	createInterviewCard,
	deleteInterviewCard,
	errorMessage,
	fetchInterviews,
	patchInterviewCard,
	type CompanyOption,
} from "./api";

function sortCards(cards: readonly InterviewCard[]): InterviewCard[] {
	return [...cards].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

function replaceCard(cards: readonly InterviewCard[], next: InterviewCard): InterviewCard[] {
	return sortCards(cards.map((c) => (c.id === next.id ? next : c)));
}

export type InterviewsState = Readonly<{
	interviews: InterviewCard[];
	companies: CompanyOption[];
	loading: boolean;
	error: string | null;
	add: (body: Record<string, unknown>) => Promise<void>;
	toggle: (card: InterviewCard, itemId: string, done: boolean) => Promise<void>;
	remove: (id: string) => Promise<void>;
}>;

export function useInterviews(): InterviewsState {
	const [interviews, setInterviews] = useState<InterviewCard[]>([]);
	const [companies, setCompanies] = useState<CompanyOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchInterviews()
			.then((data) => {
				setInterviews(sortCards(data.interviews));
				setCompanies(data.companies);
			})
			.catch((e: unknown) => setError(errorMessage(e, "Could not load your interviews")))
			.finally(() => setLoading(false));
	}, []);

	const add = useCallback(async (body: Record<string, unknown>) => {
		const card = await createInterviewCard(body);
		setInterviews((list) => sortCards([...list, card]));
	}, []);

	const toggle = useCallback(async (card: InterviewCard, itemId: string, done: boolean) => {
		const checklist = toggleChecklistItem(card.checklist, itemId, done);
		setInterviews((list) => replaceCard(list, { ...card, checklist }));
		try {
			const saved = await patchInterviewCard(card.id, { checklist });
			setInterviews((list) => replaceCard(list, saved));
			setError(null);
		} catch (e) {
			setInterviews((list) => replaceCard(list, card));
			setError(errorMessage(e, "Could not update the checklist"));
		}
	}, []);

	const remove = useCallback(async (id: string) => {
		try {
			await deleteInterviewCard(id);
			setInterviews((list) => list.filter((c) => c.id !== id));
			setError(null);
		} catch (e) {
			setError(errorMessage(e, "Could not delete the interview"));
		}
	}, []);

	return { interviews, companies, loading, error, add, toggle, remove };
}
