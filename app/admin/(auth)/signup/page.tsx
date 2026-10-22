import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSignUpForm } from "@/components/auth/admin-forms";

export const metadata: Metadata = { title: "Create an admin account", robots: { index: false } };

export default function AdminSignUpPage() {
	return (
		<Suspense>
			<AdminSignUpForm />
		</Suspense>
	);
}
