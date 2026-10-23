import { createServiceSupabase } from "@/lib/supabaseServer";
import { requireAdminPage } from "@/lib/adminAuth";
import { UsersTable } from "./UsersTable";
import { PageHeader } from "@/components/app/page-header";

async function getUsers(searchParams: { page?: string; search?: string }) {
	const supabase = createServiceSupabase();
	const page = Number.parseInt(searchParams.page || "1");
	const pageSize = 20;
	const offset = (page - 1) * pageSize;
	const search = searchParams.search || "";

	let query = supabase
		.from("profiles")
		.select("*", { count: "exact" })
		.order("created_at", { ascending: false })
		.range(offset, offset + pageSize - 1);

	if (search) {
		query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
	}

	const { data: users, count, error } = await query;

	if (error) {
		console.error("Error fetching users:", error);
		return { users: [], total: 0, page, pageSize };
	}

	return {
		users: users || [],
		total: count || 0,
		page,
		pageSize,
	};
}

export default async function UsersPage({
	searchParams,
	}: Readonly<{
	searchParams: { page?: string; search?: string };
	}>) {
	await requireAdminPage("admin");
	const { users, total, page, pageSize } = await getUsers(searchParams);
	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="space-y-6">
			<PageHeader title="Users" description="Manage user accounts, credits, and permissions." className="mb-0" />

			<UsersTable
				users={users}
				total={total}
				page={page}
				totalPages={totalPages}
			/>
		</div>
	);
}
