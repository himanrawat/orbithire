"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
	pickTranscriptionProvider,
	type TranscriptionProvider,
	type TranscriptionSession,
} from "@/lib/prep/transcription";

function joinText(base: string, addition: string): string {
	if (!addition) return base;
	if (!base) return addition;
	return `${base.trimEnd()} ${addition}`;
}

export type VoiceInput = Readonly<{
	/** null until detected on the client; false means "type instead". */
	supported: boolean | null;
	listening: boolean;
	error: string | null;
	/** Everything recognized this session, before the user's edits. */
	transcript: string;
	start: (baseText: string, onText: (text: string) => void) => void;
	stop: () => void;
}>;

/**
 * Voice answers through the transcription provider abstraction. Recognized text is
 * appended to whatever the user already typed; the textarea stays editable throughout.
 */
export function useVoiceInput(): VoiceInput {
	const [provider, setProvider] = useState<TranscriptionProvider | null>(null);
	const [supported, setSupported] = useState<boolean | null>(null);
	const [listening, setListening] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [transcript, setTranscript] = useState("");
	const session = useRef<TranscriptionSession | null>(null);
	const earlierSessions = useRef("");
	const latest = useRef("");

	useEffect(() => {
		const picked = pickTranscriptionProvider();
		setProvider(picked);
		setSupported(picked !== null);
		return () => session.current?.stop();
	}, []);

	const start = useCallback(
		(baseText: string, onText: (text: string) => void) => {
			if (!provider || session.current) return;
			setError(null);
			setListening(true);
			session.current = provider.start({
				onTranscript: (finalText, interimText) => {
					latest.current = joinText(earlierSessions.current, finalText);
					setTranscript(latest.current);
					onText(joinText(baseText, joinText(finalText, interimText)));
				},
				onError: (message) => setError(message),
				onEnd: () => {
					earlierSessions.current = latest.current;
					session.current = null;
					setListening(false);
				},
			});
		},
		[provider]
	);

	const stop = useCallback(() => {
		session.current?.stop();
	}, []);

	return { supported, listening, error, transcript, start, stop };
}
