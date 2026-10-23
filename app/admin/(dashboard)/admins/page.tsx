import { createServiceSupabase } from "@/lib/supabaseServer";
import { AdminsPanel, CreateAdminButton } from "../users/AdminsPanel";
import { PageHeader } from "@/components/app/page-header";
import { requireAdminPage } from "@/lib/adminAuth";

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
	const owner = await requireAdminPage("super_admin");

	const admins = await getAdmins();

	return (
		<div className="space-y-6">
			<PageHeader
				title="Admins"
				description="Create admins and moderators, change their roles, or remove them. Only the owner sees this page."
				actions={<CreateAdminButton />}
				className="mb-0"
			/>

			<AdminsPanel admins={admins} ownerId={owner.id} />
		</div>
	);
}
