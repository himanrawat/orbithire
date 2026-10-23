// Shown on a path or lesson the Free plan doesn't open. Server component.

import Link from "next/link";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";
import { gateMessage } from "@/lib/billing/gates";

export function PathLockedNotice() {
	return (
		<div className="space-y-3">
			<UpgradePrompt title="This path is part of Pro" message={gateMessage("learning_paths")} />
			<p className="text-sm text-muted-foreground">
				Your started path, the learning log and the library stay free.{" "}
				<Link href="/learn?tab=paths" className="font-medium text-foreground underline underline-offset-2">
					Back to your paths
				</Link>
			</p>
		</div>
	);
}
