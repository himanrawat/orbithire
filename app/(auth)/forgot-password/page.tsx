import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = {
	title: "Reset your password",
	description: "Get a link to choose a new NextMilestone password.",
	robots: { index: false },
};

export default function ForgotPasswordPage() {
	return (
		<Suspense>
			<ForgotPasswordForm />
		</Suspense>
	);
}
