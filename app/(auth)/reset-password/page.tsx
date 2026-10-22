import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = {
	title: "Choose a new password",
	description: "Set a new password for your NextMilestone account.",
	robots: { index: false },
};

export default function ResetPasswordPage() {
	return (
		<Suspense>
			<ResetPasswordForm />
		</Suspense>
	);
}
