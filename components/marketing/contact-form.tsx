"use client";

// The contact form, posting to /api/contact, in the sign-in pages' field and button styles.

import { useId, useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/auth/auth-shell";
import { CaptchaField, captchaHeaders, resetCaptcha } from "@/components/auth/CaptchaField";

export function ContactForm() {
	const messageId = useId();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...captchaHeaders() },
				body: JSON.stringify({ name, email, subject, message }),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.error || "Your message didn't send. Try again in a moment.");
				return;
			}
			setSuccess(true);
			setName("");
			setEmail("");
			setSubject("");
			setMessage("");
		} catch {
			setError("Your message didn't send. Check your connection and try again.");
		} finally {
			resetCaptcha();
			setLoading(false);
		}
	};

	if (success) {
		return (
			<div role="status" className="grid justify-items-start gap-4 py-6">
				<span className="grid size-12 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
					<CheckCircle2 size={24} strokeWidth={1.75} aria-hidden="true" />
				</span>
				<div>
					<p className="nm-display text-[28px] font-[650] leading-8 tracking-[-0.02em]">Message sent.</p>
					<p className="mt-2 text-[var(--ink-muted)]">Thanks for writing. A person will read it and reply by email.</p>
				</div>
				<SubmitButton type="button" variant="secondary" label="Send another" busyLabel="" onClick={() => setSuccess(false)} />
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="grid gap-5">
			<div className="grid gap-5 sm:grid-cols-2">
				<Field label="Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
				<Field
					label="Email"
					type="email"
					autoComplete="email"
					placeholder="you@email.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
					disabled={loading}
				/>
			</div>
			<Field
				label="Subject"
				placeholder="What's it about?"
				value={subject}
				onChange={(e) => setSubject(e.target.value)}
				required
				disabled={loading}
			/>
			<div className="grid gap-1.5">
				<label htmlFor={messageId} className="text-sm font-[550] leading-5">
					Message
				</label>
				<textarea
					id={messageId}
					rows={6}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					required
					disabled={loading}
					className="w-full resize-y rounded-[var(--radius-control)] border border-[var(--line-control)] bg-[var(--surface)] px-3.5 py-3 text-base text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-muted)] focus:border-[var(--focus)] disabled:opacity-40"
				/>
			</div>
			<CaptchaField />
			{error && <FormError>{error}</FormError>}
			<SubmitButton label="Send message" busyLabel="Sending…" busy={loading} />
		</form>
	);
}
