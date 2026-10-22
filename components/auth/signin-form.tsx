"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { sanitizeRedirect } from "@/lib/auth-utils";
import { AuthHeading, AuthShell, Field, FormError, Road, SubmitButton } from "./auth-shell";

function Aside() {
	return (
		<>
			<p className="nm-mono text-[13px] text-[var(--night-muted)]">Wed, Oct 22 · plan made at 6:30 AM</p>
			<p className="nm-display mt-3 text-[44px] leading-[46px] tracking-[-0.025em]">
				Today&apos;s plan is ready.
			</p>

			<div className="mt-10 rounded-[var(--radius-lg)] bg-[var(--night-raised)] p-6">
				<p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--cap)]">
					<span className="grid w-[11px] gap-[1.5px]" aria-hidden="true">
						<span className="nm-arch h-[6px] bg-[var(--cap)]" />
						<span className="h-2 bg-[var(--night-ink)]" />
					</span>
					Your next step
				</p>
				<p className="mt-2 text-[22px] font-semibold leading-7 tracking-[-0.01em]">Practice “Design a URL shortener”</p>
				<p className="mt-2 text-[15px] leading-[22px] text-[var(--night-muted)]">
					Your Kestrel Pay interview is in 2 days, and this question comes up most for the role.
				</p>
				<div className="mt-4 flex gap-2 text-sm font-semibold">
					<span className="rounded-[var(--radius-control)] bg-[var(--cap)] px-4 py-2.5 text-[#101216]">Start · 20 min</span>
					<span className="px-3 py-2.5 text-[var(--night-muted)]">Not today</span>
				</div>
			</div>

			<div className="mt-auto pt-12">
				<Road next="var(--stage-experienced)" caption={["behind you", "next: senior engineer"]} />
			</div>
		</>
	);
}

export function SignInForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState(searchParams.get("email") ?? "");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const redirectParam = searchParams.get("redirect");
	const signupHref = `/signup${redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : ""}`;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/signin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "We couldn't sign you in. Check your email and password.");
				return;
			}

			// Redirect to dashboard or the requested page
			router.push(sanitizeRedirect(redirectParam, "/dashboard"));
			router.refresh();
		} catch {
			setError("We couldn't reach the server. Check your connection and try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<AuthShell aside={<Aside />}>
			<AuthHeading title="Welcome back" intro="Sign in to see today's plan and pick up where you left off." />

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
					action={
						<Link href="/forgot-password" className="text-sm font-medium text-[var(--info)] underline underline-offset-2">
							Forgot password?
						</Link>
					}
				/>

				{error && <FormError>{error}</FormError>}

				<div className="mt-1">
					<SubmitButton label="Sign in" busyLabel="Signing in" busy={loading} />
				</div>
			</form>

			<p className="mt-8 border-t border-[var(--line)] pt-6 text-[15px] text-[var(--ink-muted)]">
				New to NextMilestone?{" "}
				<Link href={signupHref} className="font-semibold text-[var(--ink)] underline underline-offset-2">
					Create an account
				</Link>
			</p>
		</AuthShell>
	);
}
