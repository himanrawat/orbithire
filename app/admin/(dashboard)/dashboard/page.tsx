import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/adminAuth";
import { Users, FileText, MessageSquare, TrendingUp } from "lucide-react";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { PageHeader } from "@/components/app/page-header";

async function getStats() {
	const supabase = createServiceSupabase();

	// Get total users
	const { count: totalUsers } = await supabase
		.from("profiles")
		.select("*", { count: "exact", head: true });

	// Get new users this week
	const oneWeekAgo = new Date();
	oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
	const { count: newUsersThisWeek } = await supabase
		.from("profiles")
		.select("*", { count: "exact", head: true })
		.gte("created_at", oneWeekAgo.toISOString());

	// Get total resumes
	const { count: totalResumes } = await supabase
		.from("resumes")
		.select("*", { count: "exact", head: true });

	// Get new contact submissions
	const { count: newContacts } = await supabase
		.from("contact_submissions")
		.select("*", { count: "exact", head: true })
		.eq("status", "new");

	// Get recent users
	const { data: recentUsers } = await supabase
		.from("profiles")
		.select("id, email, full_name, created_at")
		.order("created_at", { ascending: false })
		.limit(5);

	// Get recent contact submissions
	const { data: recentContacts } = await supabase
		.from("contact_submissions")
		.select("id, name, email, subject, status, created_at")
		.order("created_at", { ascending: false })
		.limit(5);

	return {
		totalUsers: totalUsers || 0,
		newUsersThisWeek: newUsersThisWeek || 0,
		totalResumes: totalResumes || 0,
		newContacts: newContacts || 0,
		recentUsers: recentUsers || [],
		recentContacts: recentContacts || [],
	};
}

export default async function AdminDashboardPage() {
	await requireAdminPage("admin");
	const stats = await getStats();

	return (
		<div className="space-y-8">
			<PageHeader title="Dashboard" description="Overview of your platform statistics and recent activity." className="mb-0" />

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Users</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.totalUsers}</div>
						<p className="text-xs text-muted-foreground">
							+{stats.newUsersThisWeek} this week
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Resumes</CardTitle>
						<FileText className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.totalResumes}</div>
						<p className="text-xs text-muted-foreground">Generated all time</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">New Messages</CardTitle>
						<MessageSquare className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.newContacts}</div>
						<p className="text-xs text-muted-foreground">Unread contact submissions</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Growth</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">
							{stats.totalUsers > 0
								? `+${Math.round((stats.newUsersThisWeek / stats.totalUsers) * 100)}%`
								: "0%"}
						</div>
						<p className="text-xs text-muted-foreground">User growth this week</p>
					</CardContent>
				</Card>
			</div>

			{/* Recent Activity */}
			<div className="grid gap-4 md:grid-cols-2">
				{/* Recent Users */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Users</CardTitle>
						<CardDescription>Latest user registrations</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{stats.recentUsers.length === 0 ? (
								<p className="text-sm text-muted-foreground">No users yet</p>
							) : (
								stats.recentUsers.map((user: any) => (
									<div key={user.id} className="flex items-center justify-between">
										<div>
											<p className="text-sm font-medium">
												{user.full_name || "Unnamed User"}
											</p>
											<p className="text-xs text-muted-foreground">{user.email}</p>
										</div>
										<p className="text-xs text-muted-foreground">
											{new Date(user.created_at).toLocaleDateString()}
										</p>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>

				{/* Recent Contact Submissions */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Messages</CardTitle>
						<CardDescription>Latest contact form submissions</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{stats.recentContacts.length === 0 ? (
								<p className="text-sm text-muted-foreground">No messages yet</p>
							) : (
								stats.recentContacts.map((contact: any) => (
									<div key={contact.id} className="flex items-center justify-between">
										<div>
											<p className="text-sm font-medium">{contact.name}</p>
											<p className="text-xs text-muted-foreground truncate max-w-[200px]">
												{contact.subject}
											</p>
										</div>
										<div className="flex items-center gap-2">
											<span
												className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
													contact.status === "new"
														? "bg-[var(--info-soft)] text-[var(--info)]"
														: "bg-secondary text-foreground"
												}`}
											>
												{contact.status}
											</span>
										</div>
									</div>
								))
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
