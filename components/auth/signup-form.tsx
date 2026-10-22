"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Check, MailCheck, X } from "lucide-react";
import { AuthHeading, AuthShell, Field, FormError, Stone, SubmitButton } from "./auth-shell";
import { CaptchaField, captchaHeaders, resetCaptcha } from "./CaptchaField";

const PROMISES = [
	["One next step every morning", "With the reason, drawn from your interviews, learning and job matches."],
	["AI drafts, you decide", "Anything AI wrote is labeled. Nothing is sent or published without you."],
	["Your milestones, your choice", "Each one is public or private. “Open to roles” stays visible only to you."],
];

function Aside() {
	return (
		<>
			<Stone label="2 min" />
			<p className="nm-display mt-8 text-[44px] leading-[46px] tracking-[-0.025em]">Your plan is two minutes away.</p>
			<ul className="mt-auto grid gap-5 pt-12">
				{PROMISES.map(([title, body]) => (
					<li key={title} className="flex gap-3">
						<span className="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-[var(--night-raised)] text-[var(--cap)]">
							<Check size={14} strokeWidth={2.25} aria-hidden="true" />
						</span>
						<span>
							<b className="block text-[17px] font-semibold leading-[22px]">{title}</b>
							<span className="text-[15px] leading-[22px] text-[var(--night-muted)]">{body}</span>
						</span>
					</li>
				))}
			</ul>
		</>
	);
}

export function SignUpForm() {
	const searchParams = useSearchParams();
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState(searchParams.get("email") ?? "");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [avatar, setAvatar] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [resending, setResending] = useState(false);
	const [resendMessage, setResendMessage] = useState<{ ok: boolean; text: string } | null>(null);

	const redirectParam = searchParams.get("redirect");
	const redirectQuery = redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : "";
	const signinHref = `/signin${redirectQuery}`;

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = "";
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			setError("That photo is over 5 MB. Choose a smaller one.");
			return;
		}

		if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
			setError("Use a JPG, PNG or WEBP photo.");
			return;
		}

		setError("");
		const reader = new FileReader();
		reader.onload = (event) => setAvatar(event.target?.result as string);
		reader.readAsDataURL(file);
	};

	const handleResendConfirmation = async () => {
		setResending(true);
		setResendMessage(null);

		try {
			const res = await fetch("/api/auth/resend-confirmation", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...captchaHeaders() },
				body: JSON.stringify({ email }),
			});

			const data = await res.json();

			if (!res.ok) {
				setResendMessage({ ok: false, text: data.error || "We couldn't send it again. Try in a minute." });
				return;
			}

			setResendMessage({ ok: true, text: "Sent again. Check your inbox." });
		} catch {
			setResendMessage({ ok: false, text: "We couldn't reach the server. Check your connection and try again." });
		} finally {
			resetCaptcha();
			setResending(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");

		if (!name.trim()) {
			setError("Add your name.");
			return;
		}

		if (password.length < 8) {
			setError("Use at least 8 characters for your password.");
			return;
		}

		if (password !== confirmPassword) {
			setError("The two passwords don't match.");
			return;
		}

		setLoading(true);

		try {
			const res = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json", ...captchaHeaders() },
				body: JSON.stringify({
					email,
					password,
					name: name.trim(),
					phone: phone.trim() || null,
					avatar,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "We couldn't create your account. Try again.");
				return;
			}

			setSuccess(true);
		} catch {
			setError("We couldn't reach the server. Check your connection and try again.");
		} finally {
			resetCaptcha();
			setLoading(false);
		}
	};

	if (success) {
		return (
			<AuthShell aside={<Aside />}>
				<span className="mb-6 grid size-14 place-items-center rounded-[var(--radius-md)] bg-[var(--success-soft)] text-[var(--success)]">
					<MailCheck size={28} strokeWidth={1.75} aria-hidden="true" />
				</span>
				<AuthHeading
					title="Check your email"
					intro={
						<>
							We sent a confirmation link to <b className="font-semibold text-[var(--ink)]">{email}</b>. Open it to confirm
							your account, then sign in.
						</>
					}
				/>
				<p className="-mt-4 mb-8 text-[15px] text-[var(--ink-muted)]">Not there after a few minutes? Check your spam folder.</p>

				<div className="grid gap-3">
					<CaptchaField />
					<Link href={signinHref} className="nm-btn nm-btn-primary w-full justify-center">
						<span className="lbl">
							<span>Go to sign in</span>
							<span aria-hidden="true">Go to sign in</span>
						</span>
					</Link>
					<SubmitButton
						type="button"
						variant="secondary"
						label="Send the email again"
						busyLabel="Sending"
						busy={resending}
						onClick={handleResendConfirmation}
					/>
				</div>

				{resendMessage && (
					<output
						className={`mt-4 rounded-[var(--radius-control)] p-3 text-[15px] ${
							resendMessage.ok ? "bg-[var(--success-soft)] text-[var(--success)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"
						}`}
					>
						{resendMessage.text}
					</output>
				)}
			</AuthShell>
		);
	}

	return (
		<AuthShell aside={<Aside />}>
			<AuthHeading title="Create your account" intro="Setup takes about 2 minutes, and every step after this one can be skipped." />

			<form onSubmit={handleSubmit} className="grid gap-5">
				<Field
					label="Full name"
					autoComplete="name"
					placeholder="Maya Collins"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
					disabled={loading}
				/>
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
					minLength={8}
					disabled={loading}
				/>
				<Field
					label="Confirm password"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					required
					minLength={8}
					disabled={loading}
				/>

				<fieldset className="grid gap-5 border-t border-[var(--line)] pt-5">
					<legend className="sr-only">Optional details</legend>
					<div className="flex items-center gap-4">
						{/* avatars sit in the arch frame */}
						<div className="relative flex-none">
							{avatar ? (
								<>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={avatar} alt="Your profile" className="nm-arch size-16 object-cover" />
									<button
										type="button"
										onClick={() => setAvatar(null)}
										aria-label="Remove photo"
										className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-lift)]"
									>
										<X size={14} strokeWidth={2} />
									</button>
								</>
							) : (
								<label
									htmlFor="avatar"
									className="nm-arch grid size-16 cursor-pointer place-items-center border-[1.5px] border-dashed border-[var(--line-control)] bg-[var(--surface-sunken)] text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
								>
									<Camera size={22} strokeWidth={1.75} aria-hidden="true" />
									<span className="sr-only">Add a profile photo</span>
								</label>
							)}
							<input
								id="avatar"
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={handleAvatarChange}
								className="sr-only"
								disabled={loading}
							/>
						</div>
						<div>
							<p className="text-sm font-[550]">
								Profile photo <span className="font-normal text-[var(--ink-muted)]">(optional)</span>
							</p>
							<p className="text-[13px] leading-[18px] text-[var(--ink-muted)]">JPG, PNG or WEBP, up to 5 MB.</p>
						</div>
					</div>
					<Field
						label="Phone"
						optional
						type="tel"
						autoComplete="tel"
						placeholder="+91 98765 43210"
						value={phone}
						onChange={(e) => setPhone(e.target.value)}
						disabled={loading}
					/>
				</fieldset>

				<CaptchaField />
				{error && <FormError>{error}</FormError>}

				<div className="mt-1">
					<SubmitButton label="Create account" busyLabel="Creating your account" busy={loading} />
				</div>
				<p className="text-[13px] leading-[18px] text-[var(--ink-muted)]">
					By creating an account you agree to the{" "}
					<Link href="/terms" className="underline underline-offset-2">
						terms
					</Link>{" "}
					and{" "}
					<Link href="/privacy" className="underline underline-offset-2">
						privacy policy
					</Link>
					.
				</p>
			</form>

			<p className="mt-8 border-t border-[var(--line)] pt-6 text-[15px] text-[var(--ink-muted)]">
				Already have an account?{" "}
				<Link href={signinHref} className="font-semibold text-[var(--ink)] underline underline-offset-2">
					Sign in
				</Link>
			</p>
		</AuthShell>
	);
}
