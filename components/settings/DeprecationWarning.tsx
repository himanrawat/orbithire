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
		<div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
			<div className="flex items-start gap-3">
				<AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
				<div className="flex-1">
					<h3 className="text-sm font-semibold text-amber-500 dark:text-amber-400">
						Model Auto-Upgraded
					</h3>
					<p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
						{message}
					</p>
				</div>
				{onDismiss && (
					<button
						onClick={handleDismiss}
						className="flex-shrink-0 text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
						aria-label="Dismiss warning"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>
		</div>
	);
}
