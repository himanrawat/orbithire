import { createServiceSupabase } from "@/lib/supabaseServer";
import { AdminsPanel, CreateAdminButton } from "../users/AdminsPanel";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";

async function getAdmins() {
	const supabase = createServiceSupabase();
	const { data: admins, error } = await supabase
		.from("admin_users")
		.select("id, email, name, role, is_active, created_at")
		.order("created_at", { ascending: false });

	if (error) {
		console.error("Error fetching admins:", error);
		return [];
	}

	return admins || [];
}

export default async function AdminsPage() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token")?.value;

	// Require admin session
	if (!adminToken) {
		redirect("/admin/signin");
	}

	// Verify super admin role
	const supabase = createServiceSupabase();
	const { data: self } = await supabase
		.from("admin_users")
		.select("role")
		.eq("id", adminToken)
		.eq("is_active", true)
		.single();

	if (!self || self.role !== "super_admin") {
		redirect("/admin/dashboard");
	}

	const admins = await getAdmins();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Admins"
				description="The owner can create or remove admins. Badges show each role."
				actions={<CreateAdminButton />}
				className="mb-0"
			/>

			<AdminsPanel admins={admins} />
		</div>
	);
}
