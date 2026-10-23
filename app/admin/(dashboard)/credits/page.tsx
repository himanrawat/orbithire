import { createServiceSupabase } from "@/lib/supabaseServer";
import { requireAdminPage } from "@/lib/adminAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Infinity, Users, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

async function getCreditsStats() {
	const supabase = createServiceSupabase();

	// Get users with unlimited access
	const { count: unlimitedUsers } = await supabase
		.from("profiles")
		.select("*", { count: "exact", head: true })
		.eq("unlimited_access", true);

	// Get users with low credits (0-1)
	const { count: lowCreditUsers } = await supabase
		.from("profiles")
		.select("*", { count: "exact", head: true })
		.lte("ai_credits", 1)
		.eq("unlimited_access", false);

	// Get total credits distributed
	const { data: creditsData } = await supabase
		.from("profiles")
		.select("ai_credits");

	const totalCredits = creditsData?.reduce((sum, p) => sum + (p.ai_credits || 0), 0) || 0;

	// Get users who can change email
	const { count: emailChangeUsers } = await supabase
		.from("profiles")
		.select("*", { count: "exact", head: true })
		.eq("can_change_email", true);

	// Get recent unlimited grants
	const { data: recentGrants } = await supabase
		.from("admin_activity_log")
		.select("*, admin_users(name)")
		.eq("action", "grant_unlimited_access")
		.order("created_at", { ascending: false })
		.limit(5);

	// Get users with expiring unlimited access (next 7 days)
	const sevenDaysFromNow = new Date();
	sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

	const { data: expiringUsers } = await supabase
		.from("profiles")
		.select("id, email, full_name, unlimited_access_expires_at")
		.eq("unlimited_access", true)
		.not("unlimited_access_expires_at", "is", null)
		.lte("unlimited_access_expires_at", sevenDaysFromNow.toISOString())
		.gte("unlimited_access_expires_at", new Date().toISOString());

	return {
		unlimitedUsers: unlimitedUsers || 0,
		lowCreditUsers: lowCreditUsers || 0,
		totalCredits,
		emailChangeUsers: emailChangeUsers || 0,
		recentGrants: recentGrants || [],
		expiringUsers: expiringUsers || [],
	};
}

export default async function CreditsPage() {
	await requireAdminPage("admin");
	const stats = await getCreditsStats();

	return (
		<div className="space-y-6">
			<PageHeader title="Credits & access" description="Overview of AI credits and access permissions." className="mb-0" />

			{/* Stats Cards */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Unlimited Users</CardTitle>
						<Infinity className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.unlimitedUsers}</div>
						<p className="text-xs text-muted-foreground">
							Users with unlimited AI access
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Low Credits</CardTitle>
						<CreditCard className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.lowCreditUsers}</div>
						<p className="text-xs text-muted-foreground">
							Users with 0-1 credits remaining
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Total Credits</CardTitle>
						<TrendingUp className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.totalCredits}</div>
						<p className="text-xs text-muted-foreground">
							Credits across all users
						</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
						<CardTitle className="text-sm font-medium">Email Change</CardTitle>
						<Users className="h-4 w-4 text-muted-foreground" />
					</CardHeader>
					<CardContent>
						<div className="font-mono text-2xl font-semibold tabular-nums">{stats.emailChangeUsers}</div>
						<p className="text-xs text-muted-foreground">
							Users who can change email
						</p>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{/* Expiring Access */}
				<Card>
					<CardHeader>
						<CardTitle>Expiring Unlimited Access</CardTitle>
						<CardDescription>
							Users whose unlimited access expires in the next 7 days
						</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.expiringUsers.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No users with expiring access
							</p>
						) : (
							<div className="space-y-4">
								{stats.expiringUsers.map((user: any) => (
									<div key={user.id} className="flex items-center justify-between">
										<div>
											<p className="text-sm font-medium">
												{user.full_name || "Unnamed User"}
											</p>
											<p className="text-xs text-muted-foreground">{user.email}</p>
										</div>
										<Badge variant="warning">
											Expires {new Date(user.unlimited_access_expires_at).toLocaleDateString()}
										</Badge>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Recent Activity */}
				<Card>
					<CardHeader>
						<CardTitle>Recent Unlimited Grants</CardTitle>
						<CardDescription>
							Recently granted unlimited access
						</CardDescription>
					</CardHeader>
					<CardContent>
						{stats.recentGrants.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								No recent activity
							</p>
						) : (
							<div className="space-y-4">
								{stats.recentGrants.map((grant: any) => (
									<div key={grant.id} className="flex items-center justify-between">
										<div>
											<p className="text-sm font-medium">
												Granted by {grant.admin_users?.name || "Admin"}
											</p>
											<p className="text-xs text-muted-foreground">
												{grant.details?.expiresAt
													? `Expires ${new Date(grant.details.expiresAt).toLocaleDateString()}`
													: "Permanent"}
											</p>
										</div>
										<p className="text-xs text-muted-foreground">
											{new Date(grant.created_at).toLocaleDateString()}
										</p>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
