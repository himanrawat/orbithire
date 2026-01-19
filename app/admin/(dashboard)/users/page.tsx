import { createServiceSupabase } from "@/lib/supabaseServer";
import { UsersTable } from "./UsersTable";

async function getUsers(searchParams: { page?: string; search?: string }) {
	const supabase = createServiceSupabase();
	const page = parseInt(searchParams.page || "1");
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
}: {
	searchParams: { page?: string; search?: string };
}) {
	const { users, total, page, pageSize } = await getUsers(searchParams);
	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Users</h1>
				<p className="text-muted-foreground">
					Manage user accounts, credits, and permissions.
				</p>
			</div>

			<UsersTable
				users={users}
				total={total}
				page={page}
				totalPages={totalPages}
			/>
		</div>
	);
}
