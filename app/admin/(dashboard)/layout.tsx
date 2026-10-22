import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminDashboardLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await getAdminSession();

	if (!session) {
		redirect("/admin/signin");
	}

	return (
		<div className="min-h-screen bg-background">
			<AdminSidebar adminName={session.name} adminEmail={session.email} />
			<main className="lg:pl-64">
				<div className="mx-auto max-w-7xl px-4 py-8 md:px-8">{children}</div>
			</main>
		</div>
	);
}
