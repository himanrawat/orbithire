"use client";

// Forgot password and reset password, in the sign-in shell. The logic is unchanged from the
// old pages: the forgot form posts to /api/auth/forgot-password, and the reset form sets the
// new password on the recovery session Supabase opens from the email link.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Btn } from "@/components/marketing/btn";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { AuthHeading, AuthShell, Field, FormError, Road, Stone, SubmitButton } from "./auth-shell";
import { CaptchaField, captchaHeaders, resetCaptcha } from "./CaptchaField";

function Aside() {
	return (
		<>
			<Stone label="safe" />
			<p className="nm-display mt-10 text-[44px] leading-[46px] tracking-[-0.025em]">Your plan waits for you.</p>
			<p className="mt-4 max-w-[36ch] text-[17px] leading-[26px] text-[var(--night-muted)]">
				Your milestones, learning and applications stay exactly where you left them. Nothing is lost while you reset your
				password.
			</p>
			<div className="mt-auto pt-12">
				<Road caption={["behind you", "still ahead"]} />
			</div>
		</>
	);
}

function BackToSignIn() {
	return (
		<p className="mt-8 border-t border-[var(--line)] pt-6 text-[15px] text-[var(--ink-muted)]">
			Remembered it?{" "}
			<Link href="/signin" className="font-semibold text-[var(--ink)] underline underline-offset-2">
				Back to sign in
			</Link>
		</p>
	);
}

export function ForgotPasswordForm() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...captchaHeaders() },
				body: JSON.stringify({ email }),
			});
			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "We couldn't send the reset email. Try again in a minute.");
				return;
			}
			setSent(true);
		} catch {
			setError("We couldn't reach the server. Check your connection and try again.");
		} finally {
			resetCaptcha();
			setLoading(false);
		}
	};

	if (sent) {
		return (
			<AuthShell aside={<Aside />}>
				<AuthHeading
					title="Check your email"
					intro={
						<>
							If an account exists for <b className="font-semibold text-[var(--ink)]">{email}</b>, a reset link is on its way.
							It can take a minute, and it sometimes lands in spam.
						</>
					}
				/>
				<div className="grid gap-3">
					<Btn href="/signin" arrow className="w-full justify-center">
						Back to sign in
					</Btn>
					<SubmitButton
						type="button"
						variant="secondary"
						label="Use a different email"
						busyLabel="Use a different email"
						onClick={() => {
							setSent(false);
							setEmail("");
						}}
					/>
				</div>
			</AuthShell>
		);
	}

	return (
		<AuthShell aside={<Aside />}>
			<AuthHeading title="Reset your password" intro="Enter the email you signed up with and we'll send you a link to choose a new password." />
			<form onSubmit={handleSubmit} className="grid gap-5">
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
				<CaptchaField />
				{error && <FormError>{error}</FormError>}
				<div className="mt-1">
					<SubmitButton label="Send reset link" busyLabel="Sending" busy={loading} />
				</div>
			</form>
			<BackToSignIn />
		</AuthShell>
	);
}

export function ResetPasswordForm() {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const [linkInvalid, setLinkInvalid] = useState(false);

	useEffect(() => {
		// The email link signs the user in with a recovery session (or carries it in the hash).
		const checkSession = async () => {
			const supabase = getSupabaseBrowserClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (!session && !window.location.hash) setLinkInvalid(true);
		};
		void checkSession();
	}, []);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		if (password !== confirmPassword) {
			setError("The two passwords don't match.");
			return;
		}
		if (password.length < 8) {
			setError("Use at least 8 characters.");
			return;
		}

		setLoading(true);
		try {
			const supabase = getSupabaseBrowserClient();
			const { error } = await supabase.auth.updateUser({ password });
			if (error) {
				setError(error.message);
				return;
			}
			setDone(true);
		} catch {
			setError("We couldn't reach the server. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	};

	if (linkInvalid) {
		return (
			<AuthShell aside={<Aside />}>
				<AuthHeading title="This link has expired" intro="Reset links work once and expire after a while. Ask for a new one and use it within the hour." />
				<Btn href="/forgot-password" arrow className="w-full justify-center">
					Send a new link
				</Btn>
				<BackToSignIn />
			</AuthShell>
		);
	}

	if (done) {
		return (
			<AuthShell aside={<Aside />}>
				<AuthHeading title="Password updated" intro="You're signed in with your new password. Today's plan is ready." />
				<Btn href="/dashboard" arrow className="w-full justify-center">
					Go to today
				</Btn>
			</AuthShell>
		);
	}

	return (
		<AuthShell aside={<Aside />}>
			<AuthHeading title="Choose a new password" intro="Use at least 8 characters. You'll stay signed in on this device." />
			<form onSubmit={handleSubmit} className="grid gap-5">
				<Field
					label="New password"
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					disabled={loading}
				/>
				<Field
					label="Confirm new password"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
					disabled={loading}
				/>
				{error && <FormError>{error}</FormError>}
				<div className="mt-1">
					<SubmitButton label="Update password" busyLabel="Updating" busy={loading} />
				</div>
			</form>
			<BackToSignIn />
		</AuthShell>
	);
}
