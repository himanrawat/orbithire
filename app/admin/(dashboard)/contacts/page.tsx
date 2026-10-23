import { createServiceSupabase } from "@/lib/supabaseServer";
import { ContactsTable } from "./ContactsTable";
import { PageHeader } from "@/components/app/page-header";
import { contactRetentionNotice } from "@/lib/privacy/retention";

async function getContacts(searchParams: { page?: string; status?: string }) {
	const supabase = createServiceSupabase();
	const page = Number.parseInt(searchParams.page || "1");
	const pageSize = 20;
	const offset = (page - 1) * pageSize;
	const status = searchParams.status || "all";

	let query = supabase
		.from("contact_submissions")
		.select("*", { count: "exact" })
		.order("created_at", { ascending: false })
		.range(offset, offset + pageSize - 1);

	if (status !== "all") {
		query = query.eq("status", status);
	}

	const { data: contacts, count, error } = await query;

	if (error) {
		console.error("Error fetching contacts:", error);
		return { contacts: [], total: 0, page, pageSize };
	}

	return {
		contacts: contacts || [],
		total: count || 0,
		page,
		pageSize,
	};
}

export default async function ContactsPage({
	searchParams,
	}: Readonly<{
	searchParams: { page?: string; status?: string };
	}>) {
	const { contacts, total, page, pageSize } = await getContacts(searchParams);
	const totalPages = Math.ceil(total / pageSize);

	return (
		<div className="space-y-6">
			<PageHeader title="Contact messages" description={`View and manage contact form submissions. ${contactRetentionNotice()}`} className="mb-0" />

			<ContactsTable
				contacts={contacts}
				total={total}
				page={page}
				totalPages={totalPages}
			/>
		</div>
	);
}
