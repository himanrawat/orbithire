"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isGpcEnabledInBrowser } from "@/lib/privacy/gpc";

function readBrowserGpc() {
	const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
	return isGpcEnabledInBrowser(nav, document.cookie);
}

function GpcStatus({ enabled }: Readonly<{ enabled: boolean | null }>) {
	if (enabled === null) return null;
	if (!enabled) {
		return (
			<output className="block text-sm text-muted-foreground">
				We don&apos;t see a Global Privacy Control signal from this browser. You don&apos;t need one: the
				opt-out already applies to your account.
			</output>
		);
	}
	return (
		<output className="flex items-start gap-2 text-sm">
			<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" aria-hidden="true" />
			Global Privacy Control is on in this browser, and we&apos;re honoring it. Non-essential tracking is off.
		</output>
	);
}

/** "Your privacy choices" (PRD area 11): GPC is honored; we sell and share nothing. */
export function PrivacyChoices() {
	const [gpc, setGpc] = useState<boolean | null>(null);
	useEffect(() => setGpc(readBrowserGpc()), []);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<ShieldCheck className="h-5 w-5" aria-hidden="true" />
					Your privacy choices
				</CardTitle>
				<CardDescription>What happens to your data, in plain words.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 text-sm leading-6">
				<ul className="list-disc space-y-2 pl-5">
					<li>
						<b>We don&apos;t sell or share your personal data.</b> Not for money, not for ads, not with data
						brokers. So the &quot;Do not sell or share my personal information&quot; opt-out under California
						and other US state laws is already in effect for you, with nothing to switch on.
					</li>
					<li>
						<b>We honor Global Privacy Control.</b> If your browser sends a GPC signal, we treat it as an
						opt-out and turn off anything non-essential, such as analytics.
					</li>
					<li>
						<b>You stay in control.</b> Download a copy of your data or delete your account below. For any other
						request, email <a className="underline underline-offset-2" href="mailto:info@himanshurawat.in">info@himanshurawat.in</a>.
					</li>
				</ul>
				<GpcStatus enabled={gpc} />
				<p className="text-muted-foreground">
					Details are in our <Link className="underline underline-offset-2" href="/privacy">privacy policy</Link>.
				</p>
			</CardContent>
		</Card>
	);
}
