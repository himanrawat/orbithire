"use client";

import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tabClass, tabListClass } from "@/components/app/blocks";
import type { InputMode } from "@/lib/prep/constants";
import type { VoiceInput } from "./useVoiceInput";

type AnswerInputProps = Readonly<{
	value: string;
	onChange: (value: string) => void;
	mode: InputMode;
	onModeChange: (mode: InputMode) => void;
	voice: VoiceInput;
	disabled?: boolean;
}>;

function VoiceControls({ value, onChange, voice, disabled }: Readonly<Omit<AnswerInputProps, "mode" | "onModeChange">>) {
	if (voice.listening) {
		return (
			<Button type="button" variant="destructive" onClick={voice.stop}>
				<Square className="h-4 w-4" aria-hidden="true" />
				Stop recording
			</Button>
		);
	}
	return (
		<Button type="button" variant="outline" disabled={disabled} onClick={() => voice.start(value, onChange)}>
			<Mic className="h-4 w-4" aria-hidden="true" />
			{value ? "Record more" : "Start recording"}
		</Button>
	);
}

function ModeToggle({ mode, onModeChange, voiceSupported }: Readonly<{
	mode: InputMode;
	onModeChange: (mode: InputMode) => void;
	voiceSupported: boolean;
}>) {
	return (
		<fieldset>
			<legend className="sr-only">How do you want to answer?</legend>
			<div className={tabListClass}>
				<button type="button" className={tabClass(mode === "text")} aria-pressed={mode === "text"} onClick={() => onModeChange("text")}>
					Type
				</button>
				<button
					type="button"
					className={tabClass(mode === "voice")}
					aria-pressed={mode === "voice"}
					disabled={!voiceSupported}
					onClick={() => onModeChange("voice")}
				>
					<Mic className="h-4 w-4" aria-hidden="true" />
					Speak
				</button>
			</div>
		</fieldset>
	);
}

/** Step 2: answer by typing, or by voice with an editable transcript. */
export function AnswerInput({ value, onChange, mode, onModeChange, voice, disabled }: AnswerInputProps) {
	const voiceSupported = voice.supported === true;
	return (
		<div className="space-y-3">
			<ModeToggle mode={mode} onModeChange={onModeChange} voiceSupported={voiceSupported} />
			{voice.supported === false && (
				<p className="text-xs text-muted-foreground">
					Voice answers need a browser with speech recognition (such as Chrome, Edge or Safari). You can type instead.
				</p>
			)}
			{mode === "voice" && voiceSupported && (
				<div className="flex flex-wrap items-center gap-3">
					<VoiceControls value={value} onChange={onChange} voice={voice} disabled={disabled} />
					<output className="text-sm text-muted-foreground" aria-live="polite">
						{voice.listening ? "Listening… speak your answer." : "Edit the transcript below before you submit."}
					</output>
				</div>
			)}
			{voice.error && <output className="block text-sm text-[var(--danger)]">{voice.error}</output>}
			<label className="grid gap-1.5 text-sm font-[550]">
				{mode === "voice" ? "Your answer (transcript, editable)" : "Your answer"}
				<Textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					rows={10}
					maxLength={10000}
					disabled={disabled}
					placeholder="Answer as you would in the interview."
				/>
			</label>
		</div>
	);
}
