"use client";

import { AlertCircle, X } from "lucide-react";
import { useState } from "react";

interface DeprecationWarningProps {
	message: string;
	onDismiss?: () => void;
}

export function DeprecationWarning({
	message,
	onDismiss,
}: DeprecationWarningProps) {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) return null;

	const handleDismiss = () => {
		setDismissed(true);
		onDismiss?.();
	};

	return (
		<div className="mb-6 rounded-lg border border-[color-mix(in_srgb,var(--cap)_40%,transparent)] bg-[var(--cap-soft)] p-4">
			<div className="flex items-start gap-3">
				<AlertCircle className="h-5 w-5 flex-shrink-0 text-[var(--cap-ink)] mt-0.5" />
				<div className="flex-1">
					<h3 className="text-sm font-semibold text-[var(--cap-ink)]">
						Model Auto-Upgraded
					</h3>
					<p className="mt-1 text-sm text-[var(--cap-ink)]">
						{message}
					</p>
				</div>
				{onDismiss && (
					<button
						onClick={handleDismiss}
						className="flex-shrink-0 text-[var(--cap-ink)] hover:text-[var(--cap-ink)] transition-colors"
						aria-label="Dismiss warning"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);
}
