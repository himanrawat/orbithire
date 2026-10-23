import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServiceSupabase } from "@/lib/supabaseServer";
import { pushOptOutRate } from "@/lib/pwa/platform";

// Admin dashboard: push opt-in/opt-out per platform over the last 30 days (PRD Section 8:
// push opt-out < 20%, measured separately for iOS and Android).

type Row = { platform: string; subscribed: number; unsubscribed: number; denied: number };

const PLATFORM_LABELS: Record<string, string> = { ios: "iOS", android: "Android", desktop: "Desktop", other: "Other" };

async function loadStats(): Promise<Row[] | null> {
	const { data, error } = await createServiceSupabase().rpc("push_event_stats", { p_days: 30 });
	if (error) return null;
	return (data ?? []) as Row[];
}

function formatRate(row: Readonly<Row>) {
	const rate = pushOptOutRate(row);
	return rate === null ? "–" : `${rate}%`;
}

export async function PushOptOutStats() {
	const rows = await loadStats();
	if (!rows) return null;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg">Push notifications by platform</CardTitle>
				<CardDescription>Last 30 days. Target: opt-out under 20% on each platform.</CardDescription>
			</CardHeader>
			<CardContent>
				{rows.length === 0 ? (
					<p className="text-sm text-muted-foreground">No push activity yet.</p>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="text-left text-muted-foreground">
								<th className="py-1 font-medium">Platform</th>
								<th className="py-1 text-right font-medium">Turned on</th>
								<th className="py-1 text-right font-medium">Turned off</th>
								<th className="py-1 text-right font-medium">Declined</th>
								<th className="py-1 text-right font-medium">Opt-out</th>
							</tr>
						</thead>
						<tbody className="font-mono tabular-nums">
							{rows.map((row) => (
								<tr key={row.platform} className="border-t">
									<td className="py-1 font-sans">{PLATFORM_LABELS[row.platform] ?? row.platform}</td>
									<td className="py-1 text-right">{row.subscribed}</td>
									<td className="py-1 text-right">{row.unsubscribed}</td>
									<td className="py-1 text-right">{row.denied}</td>
									<td className="py-1 text-right">{formatRate(row)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</CardContent>
		</Card>
	);
}
