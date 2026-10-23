/**
 * Voice answers: a small transcription provider abstraction (PRD area 4, research R5).
 *
 * Launch provider: the browser Web Speech API (free, on-device or vendor-hosted by the
 * browser, no audio reaches our servers). Server-side vendors (Deepgram Nova-3, OpenAI
 * gpt-4o-transcribe) can be added later as providers that record audio with
 * MediaRecorder and post it to an API route; the UI only talks to this interface.
 *
 * Client-only at runtime, but importable anywhere (no top-level window access).
 */

export type TranscriptionProviderId = "web_speech" | "deepgram" | "openai";

export type TranscriptHandlers = Readonly<{
	/** Full transcript so far: committed text plus the current interim phrase. */
	onTranscript: (finalText: string, interimText: string) => void;
	onError: (message: string) => void;
	onEnd: () => void;
}>;

export type TranscriptionSession = Readonly<{ stop: () => void }>;

export interface TranscriptionProvider {
	readonly id: TranscriptionProviderId;
	readonly label: string;
	isSupported(): boolean;
	start(handlers: TranscriptHandlers, lang?: string): TranscriptionSession;
}

// Minimal Web Speech API typings (not in lib.dom for every TS version).
type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; 0: SpeechAlternative; length: number };
type SpeechResultEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error: string };
type SpeechRecognitionLike = {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onresult: ((event: SpeechResultEvent) => void) | null;
	onerror: ((event: SpeechErrorEvent) => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechGlobals = {
	SpeechRecognition?: SpeechRecognitionCtor;
	webkitSpeechRecognition?: SpeechRecognitionCtor;
};

export function getSpeechRecognitionCtor(scope: unknown): SpeechRecognitionCtor | null {
	if (!scope || typeof scope !== "object") return null;
	const g = scope as SpeechGlobals;
	return g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
	"not-allowed": "Microphone access was blocked. Allow it in your browser, or type your answer.",
	"service-not-allowed": "Voice input isn't available in this browser. Type your answer instead.",
	"no-speech": "We didn't hear anything. Try again, or type your answer.",
	"audio-capture": "No microphone was found. Type your answer instead.",
	network: "Voice input needs a network connection in this browser. Type your answer instead.",
};

export function speechErrorMessage(code: string): string {
	return ERROR_MESSAGES[code] ?? "Voice input stopped. You can keep editing the text.";
}

/** Splits recognition results into committed text and the current interim phrase. */
export function collectTranscript(results: ArrayLike<SpeechResult>): { finalText: string; interimText: string } {
	let finalText = "";
	let interimText = "";
	for (let i = 0; i < results.length; i++) {
		const result = results[i];
		const text = result[0]?.transcript ?? "";
		if (result.isFinal) finalText += text;
		else interimText += text;
	}
	return { finalText: finalText.trim(), interimText: interimText.trim() };
}

function currentScope(): unknown {
	return typeof window === "undefined" ? null : window;
}

export const webSpeechProvider: TranscriptionProvider = {
	id: "web_speech",
	label: "Browser speech recognition",
	isSupported() {
		return getSpeechRecognitionCtor(currentScope()) !== null;
	},
	start(handlers, lang = "en-US") {
		const Ctor = getSpeechRecognitionCtor(currentScope());
		if (!Ctor) {
			handlers.onError(speechErrorMessage("service-not-allowed"));
			handlers.onEnd();
			return { stop: () => undefined };
		}
		const recognition = new Ctor();
		recognition.lang = lang;
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.onresult = (event) => {
			const { finalText, interimText } = collectTranscript(event.results);
			handlers.onTranscript(finalText, interimText);
		};
		recognition.onerror = (event) => handlers.onError(speechErrorMessage(event.error));
		recognition.onend = () => handlers.onEnd();
		recognition.start();
		return { stop: () => recognition.stop() };
	},
};

/** Providers in preference order. Server vendors join here once R5 picks one. */
const PROVIDERS: readonly TranscriptionProvider[] = [webSpeechProvider];

/** The first supported provider, or null (the UI then falls back to typing). */
export function pickTranscriptionProvider(
	providers: readonly TranscriptionProvider[] = PROVIDERS
): TranscriptionProvider | null {
	return providers.find((p) => p.isSupported()) ?? null;
}
