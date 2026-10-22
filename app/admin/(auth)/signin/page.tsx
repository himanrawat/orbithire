import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminSignInForm } from "@/components/auth/admin-forms";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false } };

export default function AdminSignInPage() {
	return (
		<Suspense>
			<AdminSignInForm />
		</Suspense>
	);
}
