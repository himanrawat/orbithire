"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X, User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileData } from "@/components/app/ProfileDataProvider";

type ProfileData = {
	full_name?: string | null;
	email?: string | null;
	skills?: string[] | null;
};

type MissingField = {
	field: string;
	label: string;
};

function checkProfileCompletion(profile: ProfileData | null): {
	isComplete: boolean;
	missingFields: MissingField[];
} {
	const missingFields: MissingField[] = [];

	if (!profile) {
		return {
			isComplete: false,
			missingFields: [
				{ field: "full_name", label: "Full Name" },
				{ field: "skills", label: "Skills" },
			],
		};
	}

	if (!profile.full_name?.trim()) {
		missingFields.push({ field: "full_name", label: "Full Name" });
	}

	if (!profile.skills || profile.skills.length === 0) {
		missingFields.push({ field: "skills", label: "Skills (at least one)" });
	}

	return {
		isComplete: missingFields.length === 0,
		missingFields,
	};
}

interface ProfileCompletionBannerProps {
	variant?: "banner" | "popup";
	className?: string;
}

export function ProfileCompletionBanner({
	variant = "banner",
	className,
}: Readonly<ProfileCompletionBannerProps>) {
	const { profile, loading } = useProfileData();
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		// Check if already dismissed in this session
		const dismissedKey = `profile-banner-dismissed-${variant}`;
		if (sessionStorage.getItem(dismissedKey) === "true") {
			setDismissed(true);
			return;
		}
	}, [variant]);

	const handleDismiss = () => {
		const dismissedKey = `profile-banner-dismissed-${variant}`;
		sessionStorage.setItem(dismissedKey, "true");
		setDismissed(true);
	};

	if (loading || dismissed) {
		return null;
	}

	const { isComplete, missingFields } = checkProfileCompletion(profile);

	if (isComplete) {
		return null;
	}

	if (variant === "popup") {
		return (
			<AnimatePresence>
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -20 }}
					className={cn(
						"mb-6 rounded-lg border border-[color-mix(in_srgb,var(--kind-interview)_40%,transparent)] bg-[var(--kind-interview-soft)] p-4",
						className
					)}
				>
					<div className="flex items-start gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--kind-interview-soft)]">
							<AlertTriangle className="h-5 w-5 text-[var(--kind-interview)]" />
						</div>
						<div className="flex-1">
							<div className="flex items-start justify-between gap-2">
								<div>
									<h3 className="font-semibold text-foreground">
										Complete Your Profile
									</h3>
									<p className="mt-1 text-sm text-muted-foreground">
										For better resume generation, please complete your profile with
										the following:
									</p>
								</div>
								<button
									onClick={handleDismiss}
									className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<ul className="mt-2 space-y-1">
								{missingFields.map(({ field, label }) => (
									<li
										key={field}
										className="flex items-center gap-2 text-sm text-[var(--kind-interview)]"
									>
										<span className="h-1.5 w-1.5 rounded-full bg-[var(--kind-interview)]" />
										{label}
									</li>
								))}
							</ul>
							<div className="mt-3 flex items-center gap-3">
								<Button size="sm" asChild>
									<Link href="/profile">
										<User className="mr-2 h-4 w-4" />
										Complete Profile
									</Link>
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="text-muted-foreground"
									onClick={handleDismiss}
								>
									Continue anyway
								</Button>
							</div>
						</div>
					</div>
				</motion.div>
			</AnimatePresence>
		);
	}

	// Banner variant (for dashboard)
	return (
		<motion.div
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			className={cn(
				"mb-6 flex items-center justify-between rounded-lg border border-[color-mix(in_srgb,var(--kind-interview)_40%,transparent)] bg-[var(--kind-interview-soft)] px-4 py-3",
				className
			)}
		>
			<div className="flex items-center gap-3">
				<AlertTriangle className="h-5 w-5 text-[var(--kind-interview)]" />
				<div>
					<p className="font-medium text-foreground">
						Your profile is incomplete
					</p>
					<p className="text-sm text-muted-foreground">
						Missing: {missingFields.map((f) => f.label).join(", ")}
					</p>
				</div>
			</div>
			<Button size="sm" asChild>
				<Link href="/profile">
					Complete Profile
					<ChevronRight className="ml-1 h-4 w-4" />
				</Link>
			</Button>
		</motion.div>
	);
}

// Hook for checking profile completion status
export function useProfileCompletion() {
	const { profile, loading } = useProfileData();

	const { isComplete, missingFields } = checkProfileCompletion(profile);

	return { isComplete, missingFields, loading, profile };
}
