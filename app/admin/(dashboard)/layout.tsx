import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

async function getAdminSession() {
	const cookieStore = cookies();
	const adminToken = cookieStore.get("admin_token");

	if (!adminToken) {
		return null;
	}

	// Verify admin token by calling our API
	try {
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
		const res = await fetch(`${baseUrl}/api/auth/admin/verify`, {
			headers: {
				Cookie: `admin_token=${adminToken.value}`,
			},
			cache: "no-store",
		});

		if (!res.ok) {
			return null;
		}

		return await res.json();
	} catch {
		return null;
	}
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
			<main className="lg:pl-64 transition-all duration-300">
				<div className="container py-8 px-4 lg:px-8">{children}</div>
			</main>
		</div>
	);
}
