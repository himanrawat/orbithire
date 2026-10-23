/** Client fetch helpers for the /api/prep routes. Module scope, no component state. */
import type { FeedbackQuota } from "@/lib/billing/gates";
import type { PrepAccess } from "@/lib/prep/access";
import type { InterviewCard, PracticeAttempt, PrepQuestion } from "@/lib/prep/constants";

type ErrorBody = { error?: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		cache: "no-store",
		...init,
		headers: init?.body ? { "Content-Type": "application/json" } : undefined,
	});
	const json = (await res.json().catch(() => ({}))) as T & ErrorBody;
	if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
	return json;
}

export function errorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback;
}

export async function fetchQuestions(query: string): Promise<PrepQuestion[]> {
	const { questions } = await request<{ questions: PrepQuestion[] }>(`/api/prep/questions?${query}`);
	return questions;
}

export async function fetchQuestion(id: string) {
	return request<{ question: PrepQuestion; attempts: PracticeAttempt[]; access: PrepAccess }>(
		`/api/prep/questions/${encodeURIComponent(id)}`
	);
}

export type AttemptResponse = {
	attempt: PracticeAttempt;
	feedbackError: string | null;
	feedbackLimitReached?: boolean;
	feedbackQuota?: FeedbackQuota;
};

export async function submitAttempt(body: Record<string, unknown>): Promise<AttemptResponse> {
	return request<AttemptResponse>("/api/prep/attempts", { method: "POST", body: JSON.stringify(body) });
}

export async function flagAttempt(id: string): Promise<PracticeAttempt> {
	const { attempt } = await request<{ attempt: PracticeAttempt }>(`/api/prep/attempts/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ flaggedWrong: true }),
	});
	return attempt;
}

export async function reportQuestion(body: Record<string, unknown>): Promise<void> {
	await request<{ id: string }>("/api/prep/reports", { method: "POST", body: JSON.stringify(body) });
}

export type CompanyOption = { id: string; name: string };

export async function fetchInterviews() {
	return request<{ interviews: InterviewCard[]; companies: CompanyOption[] }>("/api/prep/interviews");
}

export async function createInterviewCard(body: Record<string, unknown>): Promise<InterviewCard> {
	const { interview } = await request<{ interview: InterviewCard }>("/api/prep/interviews", {
		method: "POST",
		body: JSON.stringify(body),
	});
	return interview;
}

export async function patchInterviewCard(id: string, body: Record<string, unknown>): Promise<InterviewCard> {
	const { interview } = await request<{ interview: InterviewCard }>(`/api/prep/interviews/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
	return interview;
}

export async function deleteInterviewCard(id: string): Promise<void> {
	await request<{ ok: boolean }>(`/api/prep/interviews/${id}`, { method: "DELETE" });
}

export async function startMock() {
	return request<{ mockId: string; durationMinutes: number; questions: PrepQuestion[] }>("/api/prep/mock");
}
