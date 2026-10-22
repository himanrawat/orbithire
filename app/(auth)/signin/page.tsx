import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/signin-form";

export const metadata: Metadata = {
	title: "Sign in",
	description: "Sign in to NextMilestone to see today's plan.",
	icons: { icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }] },
};

export default function SignInPage() {
	return (
		<Suspense>
			<SignInForm />
		</Suspense>
	);
}
