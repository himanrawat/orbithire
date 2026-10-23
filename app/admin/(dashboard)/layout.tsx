import { redirect } from "next/navigation";
import { getAdminLayoutSession } from "@/lib/adminAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

// Session check for every admin page. Role and temporary-password checks run per page
// through requireAdminPage, since the layout doesn't know the current path.
export default async function AdminDashboardLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await getAdminLayoutSession();

	if (!session) {
		redirect("/admin/signin");
	}

	return (
		<div className="min-h-screen bg-background">
			<AdminSidebar
				adminName={session.name}
				adminEmail={session.email}
				role={session.role}
				mustChangePassword={session.must_change_password}
			/>
			<main className="lg:pl-64">
				<div className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</div>
			</main>
		</div>
	);
}
