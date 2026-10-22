"use client";

// Shared parts of the sign-in and sign-up pages: the two-column shell with the ink aside,
// and the form controls in the NextMilestone style.

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AuthShell({ children, aside }: { children: ReactNode; aside: ReactNode }) {
	return (
		<div className="nm-wrap grid w-full items-stretch gap-10 py-8 md:py-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
			<div className="flex items-center justify-center lg:justify-start">
				<div className="w-full max-w-[440px]">{children}</div>
			</div>
			<aside className="nm-grain hidden overflow-hidden rounded-[var(--radius-xl)] bg-[var(--night)] p-10 text-[var(--night-ink)] [--grain-o:.5] lg:flex lg:flex-col">
				<div className="relative z-[2] flex flex-1 flex-col">{aside}</div>
			</aside>
		</div>
	);
}

export function AuthHeading({ title, intro }: { title: string; intro: ReactNode }) {
	return (
		<div className="mb-8">
			<h1 className="nm-display text-[32px] font-[650] leading-9 tracking-[-0.02em] md:text-[44px] md:leading-[46px] md:tracking-[-0.025em]">
				{title}
			</h1>
			<p className="mt-3 text-[17px] leading-[26px] text-[var(--ink-muted)]">{intro}</p>
		</div>
	);
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
	label: string;
	hint?: string;
	optional?: boolean;
	action?: ReactNode;
};

const inputClass =
	"h-12 w-full rounded-[var(--radius-control)] border border-[var(--line-control)] bg-[var(--surface)] px-3.5 text-base text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-muted)] focus:border-[var(--focus)] disabled:opacity-40";

export function Field({ label, hint, optional, action, id, type, className, ...rest }: FieldProps) {
	const auto = useId();
	const fieldId = id ?? auto;
	const hintId = hint ? `${fieldId}-hint` : undefined;
	const [shown, setShown] = useState(false);
	const isPassword = type === "password";

	return (
		<div className={cn("grid gap-1.5", className)}>
			<div className="flex items-baseline justify-between gap-3">
				<label htmlFor={fieldId} className="text-sm font-[550] leading-5">
					{label}
					{optional && <span className="font-normal text-[var(--ink-muted)]"> (optional)</span>}
				</label>
				{action}
			</div>
			<div className="relative">
				<input
					id={fieldId}
					type={isPassword && shown ? "text" : type}
					aria-describedby={hintId}
					className={cn(inputClass, isPassword && "pr-12")}
					{...rest}
				/>
				{isPassword && (
					<button
						type="button"
						onClick={() => setShown((v) => !v)}
						aria-label={shown ? "Hide password" : "Show password"}
						aria-pressed={shown}
						className="absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
					>
						{shown ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
					</button>
				)}
			</div>
			{hint && (
				<p id={hintId} className="text-[13px] leading-[18px] text-[var(--ink-muted)]">
					{hint}
				</p>
			)}
		</div>
	);
}

export function FormError({ children }: { children: ReactNode }) {
	return (
		<div role="alert" className="flex gap-2.5 rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-3 text-[15px] leading-[22px] text-[var(--danger)]">
			<AlertCircle size={20} strokeWidth={1.75} className="mt-px flex-none" aria-hidden="true" />
			<span>{children}</span>
		</div>
	);
}

/** A form button with the website button's rolling label; shows a spinner and `busyLabel` while busy. */
export function SubmitButton({
	label,
	busyLabel,
	busy,
	variant = "primary",
	type = "submit",
	onClick,
}: {
	label: string;
	busyLabel: string;
	busy?: boolean;
	variant?: "primary" | "secondary";
	type?: "submit" | "button";
	onClick?: () => void;
}) {
	return (
		<button
			type={type}
			onClick={onClick}
			disabled={busy}
			className={cn(
				"nm-btn w-full justify-center disabled:cursor-wait disabled:opacity-70",
				variant === "primary" ? "nm-btn-primary" : "nm-btn-secondary",
			)}
		>
			{busy ? (
				<>
					<Loader2 size={18} className="animate-spin" aria-hidden="true" />
					<span>{busyLabel}</span>
				</>
			) : (
				<>
					<span className="lbl">
						<span>{label}</span>
						<span aria-hidden="true">{label}</span>
					</span>
					{variant === "primary" && <ArrowRight className="ar" size={18} strokeWidth={1.75} aria-hidden="true" />}
				</>
			)}
		</button>
	);
}

/** The roadside milestone: an arch cap over a stone, the brand's one illustration. */
export function Stone({ cap = "var(--cap)", label, size = 96 }: { cap?: string; label?: string; size?: number }) {
	return (
		<div className="grid gap-2" style={{ width: size }} aria-hidden="true">
			<div className="nm-arch" style={{ height: size / 2, background: cap }} />
			<div className="grid place-items-center bg-[var(--night-ink)]" style={{ height: size }}>
				{label && (
					<span className="nm-display text-[var(--night)]" style={{ fontSize: size / 4.4, letterSpacing: "-0.02em" }}>
						{label}
					</span>
				)}
			</div>
		</div>
	);
}

/** Past milestones in ink, the next one in its colour, the rest still ahead. */
export function Road({ next = "var(--cap)", caption }: { next?: string; caption: [string, string] }) {
	const heights = [22, 28, 34, 46, 40, 46];
	return (
		<div aria-hidden="true">
			<div className="flex h-[84px] items-end gap-7 border-b-2 border-[var(--night-line)] px-2">
				{heights.map((h, i) => (
					<div key={i} className="grid gap-0.5" style={{ width: i === 3 ? 34 : 26 }}>
						<div
							className="nm-arch"
							style={{ height: i === 3 ? 17 : 13, background: i < 3 ? "var(--night-ink)" : i === 3 ? next : "var(--night-line)" }}
						/>
						<div style={{ height: h, background: i <= 3 ? "var(--night-ink)" : "var(--night-line)" }} />
					</div>
				))}
			</div>
			<div className="nm-mono mt-2 flex justify-between px-2 text-xs text-[var(--night-muted)]">
				<span>{caption[0]}</span>
				<span>{caption[1]}</span>
			</div>
		</div>
	);
}
