import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
	title: "Create your account",
	description: "Create a NextMilestone account. Setup takes about 2 minutes.",
	icons: { icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }] },
};

export default function SignUpPage() {
	return (
		<Suspense>
			<SignUpForm />
		</Suspense>
	);
}
