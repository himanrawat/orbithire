import { requireAdminPage } from "@/lib/adminAuth";

// Every role can change their own password here, including an admin who signed in
// with a temporary password (every other page sends them back to this one).
export default async function AdminSettingsLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const admin = await requireAdminPage({ minRole: "moderator", allowPasswordChangePending: true });

	return (
		<div className="space-y-6">
			{admin.must_change_password && (
				<output className="block rounded-[var(--radius-control)] border border-[var(--cap)] bg-[var(--cap-soft)] p-4 text-sm text-[var(--ink)]">
					<strong className="block font-semibold">Set a new password to continue</strong>
					You signed in with a temporary password. Change it below, then sign in again. The rest of
					the admin panel unlocks after that.
				</output>
			)}
			{children}
		</div>
	);
}
