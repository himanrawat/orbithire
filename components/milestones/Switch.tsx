"use client";

import { cn } from "@/lib/utils";

/** A labeled on/off switch (native button with role="switch"). */
export function Switch({
	id,
	checked,
	onChange,
	label,
	description,
	disabled,
}: Readonly<{
	id: string;
	checked: boolean;
	onChange: (value: boolean) => void;
	label: string;
	description?: string;
	disabled?: boolean;
}>) {
	const descriptionId = description ? `${id}-description` : undefined;
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="space-y-1">
				<label htmlFor={id} className="text-sm font-semibold">
					{label}
				</label>
				{description && (
					<p id={descriptionId} className="text-sm leading-5 text-muted-foreground">
						{description}
					</p>
				)}
			</div>
			<button
				id={id}
				type="button"
				role="switch"
				aria-checked={checked}
				aria-describedby={descriptionId}
				disabled={disabled}
				onClick={() => onChange(!checked)}
				className={cn(
					"relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
					checked ? "bg-primary" : "bg-muted"
				)}
			>
				<span
					className={cn(
						"inline-block h-5 w-5 rounded-full bg-background shadow transition-transform",
						checked ? "translate-x-5" : "translate-x-0.5"
					)}
				/>
			</button>
		</div>
	);
}
