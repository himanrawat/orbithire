import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

async function getAdminSession() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token")?.value;

	if (!adminToken) {
		return null;
	}

	const supabase = createServiceSupabase();
	const { data: admin, error } = await supabase
		.from("admin_users")
		.select("id, email, name, role, is_active")
		.eq("id", adminToken)
		.single();

	if (error || !admin || !admin.is_active) {
		return null;
	}

	return admin;
}

export default async function AdminDashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
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
