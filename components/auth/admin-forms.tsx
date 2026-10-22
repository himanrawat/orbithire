"use client";

// Admin sign in and sign up in the sign-in shell. Same endpoints and checks as before:
// /api/auth/admin/signin sets the admin session, /api/auth/admin/signup needs an access code.

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthHeading, AuthShell, Field, FormError, Stone, SubmitButton } from "./auth-shell";
import { CaptchaField, captchaHeaders, resetCaptcha } from "./CaptchaField";

const DUTIES: [string, string][] = [
	["Users", "Look people up, fix emails and credits."],
	["Moderation", "Review reports and contact messages."],
	["Platform", "Access codes, settings and worker tasks."],
];

function Aside() {
	return (
		<>
			<Stone label="admin" />
			<p className="nm-display mt-10 text-[44px] leading-[46px] tracking-[-0.025em]">Keep the road clear.</p>
			<ul className="mt-8 grid gap-4">
				{DUTIES.map(([b, rest]) => (
					<li key={b} className="border-t border-[var(--night-line)] pt-4 text-[15px] leading-[22px]">
						<b className="block font-semibold">{b}</b>
						<span className="text-[var(--night-muted)]">{rest}</span>
					</li>
				))}
			</ul>
			<p className="mt-auto pt-12 text-[13px] leading-[18px] text-[var(--night-muted)]">
				Admin actions are logged. Sign out on shared computers.
			</p>
		</>
	);
}

export function AdminSignInForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const registered = searchParams.get("registered") === "true";

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/admin/signin", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...captchaHeaders() },
				body: JSON.stringify({ email, password }),
			});
			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "We couldn't sign you in. Check your email and password.");
				return;
			}
			router.push("/admin/dashboard");
			router.refresh();
		} catch {
			setError("We couldn't reach the server. Check your connection and try again.");
		} finally {
			resetCaptcha();
			setLoading(false);
		}
	};

	return (
		<AuthShell aside={<Aside />}>
			<AuthHeading
				title="Admin sign in"
				intro={registered ? "Your admin account is ready. Sign in to continue." : "For the NextMilestone team. Use your admin email and password."}
			/>
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
				<Field
					label="Password"
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					disabled={loading}
				/>
				<CaptchaField />
				{error && <FormError>{error}</FormError>}
				<div className="mt-1">
					<SubmitButton label="Sign in" busyLabel="Signing in" busy={loading} />
				</div>
			</form>
			<p className="mt-8 border-t border-[var(--line)] pt-6 text-[15px] text-[var(--ink-muted)]">
				Have an access code?{" "}
				<Link href="/admin/signup" className="font-semibold text-[var(--ink)] underline underline-offset-2">
					Create an admin account
				</Link>
			</p>
		</AuthShell>
	);
}

export function AdminSignUpForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [accessCode, setAccessCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

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
			const res = await fetch("/api/auth/admin/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...captchaHeaders() },
				body: JSON.stringify({ name, email, password, accessCode }),
			});
			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "We couldn't create the account. Check the access code.");
				return;
			}
			router.push("/admin/signin?registered=true");
		} catch {
			setError("We couldn't reach the server. Check your connection and try again.");
		} finally {
			resetCaptcha();
			setLoading(false);
		}
	};

	return (
		<AuthShell aside={<Aside />}>
			<AuthHeading title="Create an admin account" intro="You need an access code from the owner. Each code works once." />
			<form onSubmit={handleSubmit} className="grid gap-5">
				<Field label="Full name" autoComplete="name" placeholder="Maya Collins" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} />
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
				<Field
					label="Password"
					type="password"
					autoComplete="new-password"
					hint="At least 8 characters."
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
					disabled={loading}
				/>
				<Field
					label="Confirm password"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
					disabled={loading}
				/>
				<Field
					label="Access code"
					autoComplete="off"
					value={accessCode}
					onChange={(e) => setAccessCode(e.target.value)}
					required
					disabled={loading}
				/>
				<CaptchaField />
				{error && <FormError>{error}</FormError>}
				<div className="mt-1">
					<SubmitButton label="Create admin account" busyLabel="Creating account" busy={loading} />
				</div>
			</form>
			<p className="mt-8 border-t border-[var(--line)] pt-6 text-[15px] text-[var(--ink-muted)]">
				Already an admin?{" "}
				<Link href="/admin/signin" className="font-semibold text-[var(--ink)] underline underline-offset-2">
					Sign in
				</Link>
			</p>
		</AuthShell>
	);
}
