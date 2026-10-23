"use client";

// Share a milestone, something you learned, a question or a link.

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { nativeSelectClass, tabClass, tabListClass } from "@/components/app/blocks";
import { createPost, errorMessage, type PostDraft } from "@/lib/community/client";
import {
	COMMUNITY_LIMITS,
	POST_TYPE_LABELS,
	POST_TYPES,
	TOPIC_LABELS,
	TOPICS,
	isTopic,
	type PostType,
} from "@/lib/community/types";

const PLACEHOLDERS: Readonly<Record<PostType, { title: string; body: string }>> = {
	milestone: { title: "Shipped my first design doc", body: "What you did and what you'd tell someone starting out." },
	learning: { title: "What finally made React effects click", body: "Two or three sentences in your own words." },
	question: { title: "How did you prepare for your first system design loop?", body: "Add context so people can answer well." },
	link: { title: "A clear guide to database indexes", body: "Why it's worth reading." },
};

function emptyDraft(type: PostType = "milestone"): PostDraft {
	return { type, topic: "career-growth", title: "", body: "", url: "" };
}

function TypePicker({ value, onChange }: Readonly<{ value: PostType; onChange: (type: PostType) => void }>) {
	return (
		<fieldset>
			<legend className="sr-only">Post type</legend>
			<div className={tabListClass}>
				{POST_TYPES.map((type) => (
					<label key={type} className={tabClass(value === type)}>
						<input
							type="radio"
							name="post-type"
							value={type}
							className="sr-only"
							checked={value === type}
							onChange={() => onChange(type)}
						/>
						{POST_TYPE_LABELS[type]}
					</label>
				))}
			</div>
		</fieldset>
	);
}

export function PostComposer() {
	const router = useRouter();
	const [draft, setDraft] = useState<PostDraft>(emptyDraft());
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const update = (patch: Partial<PostDraft>) => setDraft((current) => ({ ...current, ...patch }));

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await createPost(draft);
			setDraft(emptyDraft(draft.type));
			router.refresh();
		} catch (err) {
			setError(errorMessage(err, "Could not publish this post"));
		} finally {
			setBusy(false);
		}
	}

	const placeholder = PLACEHOLDERS[draft.type];
	const isLink = draft.type === "link";
	return (
		<Card>
			<CardContent className="p-5">
				<form onSubmit={(event) => void submit(event)} className="space-y-4" aria-label="New post">
					<TypePicker value={draft.type} onChange={(type) => update({ type })} />
					<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
						<div className="space-y-1.5">
							<Label htmlFor="post-title">Title</Label>
							<Input
								id="post-title"
								required
								minLength={3}
								maxLength={COMMUNITY_LIMITS.titleLength}
								placeholder={placeholder.title}
								value={draft.title}
								onChange={(event) => update({ title: event.target.value })}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="post-topic">Topic</Label>
							<select
								id="post-topic"
								className={nativeSelectClass}
								value={draft.topic}
								onChange={(event) => {
									if (isTopic(event.target.value)) update({ topic: event.target.value });
								}}
							>
								{TOPICS.map((topic) => (
									<option key={topic} value={topic}>
										{TOPIC_LABELS[topic]}
									</option>
								))}
							</select>
						</div>
					</div>
					{isLink && (
						<div className="space-y-1.5">
							<Label htmlFor="post-url">Link</Label>
							<Input
								id="post-url"
								type="url"
								inputMode="url"
								required
								maxLength={COMMUNITY_LIMITS.urlLength}
								placeholder="https://…"
								value={draft.url}
								onChange={(event) => update({ url: event.target.value })}
							/>
						</div>
					)}
					<div className="space-y-1.5">
						<Label htmlFor="post-body">{isLink ? "Why share it? (optional)" : "Details (optional)"}</Label>
						<Textarea
							id="post-body"
							maxLength={COMMUNITY_LIMITS.bodyLength}
							placeholder={placeholder.body}
							value={draft.body}
							onChange={(event) => update({ body: event.target.value })}
						/>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" variant="cap" disabled={busy}>
							{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							Post
						</Button>
						{error && <output className="text-sm text-[var(--danger)]">{error}</output>}
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
