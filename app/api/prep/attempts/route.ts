import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseJson } from "@/lib/api";
import { requireUser } from "@/lib/jobs/server";
import { logAiGeneration } from "@/lib/ai/generations/log";
import { ProviderError } from "@/lib/ai/providers/baseProvider";
import { generateFeedback, loadAiConfig, type FeedbackResult } from "@/lib/prep/ai";
import type { PrepQuestion } from "@/lib/prep/constants";
import { attemptCreateSchema, type AttemptCreate } from "@/lib/prep/schema";
import { getQuestion, insertAttempt } from "@/lib/prep/server";
import { notFound, serverError } from "@/lib/prep/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FeedbackOutcome = { result: FeedbackResult; error?: undefined } | { result: null; error: string };

const NO_AI_MESSAGE = "Your answer is saved. Add an AI provider in Settings to get feedback.";
const AI_FAILED_MESSAGE = "Your answer is saved, but feedback isn't available right now. Try again in a minute.";

async function requestFeedback(
	supabase: SupabaseClient,
	userId: string,
	question: PrepQuestion,
	answer: string
): Promise<FeedbackOutcome> {
	const config = await loadAiConfig(supabase, userId);
	if (!config) return { result: null, error: NO_AI_MESSAGE };
	try {
		return { result: await generateFeedback(config, question, answer) };
	} catch (error) {
		const detail = error instanceof ProviderError ? error.type : "unknown";
		console.error(`[prep] feedback failed (${detail}):`, error);
		return { result: null, error: AI_FAILED_MESSAGE };
	}
}

function transcriptFor(body: AttemptCreate): string | null {
	return body.inputMode === "voice" && body.transcript ? body.transcript : null;
}

/** POST /api/prep/attempts – save a practice answer and return it with AI feedback. */
export async function POST(req: NextRequest) {
	const auth = await requireUser();
	if (auth.error) return auth.error;
	const parsed = await parseJson(req, attemptCreateSchema);
	if (!parsed.success) return parsed.response;
	const body = parsed.data;
	const { supabase, user } = auth;

	const question = await getQuestion(supabase, body.questionId);
	if (!question) return notFound("Question");

	const outcome = await requestFeedback(supabase, user.id, question, body.answerText);
	try {
		const attempt = await insertAttempt(supabase, user.id, {
			questionId: question.id,
			answerText: body.answerText,
			transcript: transcriptFor(body),
			inputMode: body.inputMode,
			mockId: body.mockId ?? null,
			feedback: outcome.result?.feedback ?? null,
			feedbackModel: outcome.result?.model ?? null,
		});
		if (outcome.result) {
			await logAiGeneration(supabase, {
				userId: user.id,
				feature: "prep_feedback",
				model: outcome.result.model,
				provider: outcome.result.provider,
				itemType: "practice_attempt",
				itemRef: attempt.id,
			});
		}
		return NextResponse.json({ attempt, feedbackError: outcome.error ?? null }, { status: 201 });
	} catch (error) {
		return serverError("save attempt", error, "Could not save your answer");
	}
}
