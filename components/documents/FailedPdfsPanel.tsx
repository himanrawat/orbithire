"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfStatusBadge } from "@/components/PdfStatusBadge";

interface FailedDoc {
	id: string;
	type: "resume" | "cover_letter";
	title: string;
	company: string | null;
	pdf_status: "failed" | "queued" | "rendering";
	pdf_error: string | null;
	updated_at: string;
}

/**
 * Documents whose PDF failed (or got stuck), with per-row retry (badge) and
 * "Retry all". Renders nothing when there is nothing to fix.
 */
export function FailedPdfsPanel({ className }: { className?: string }) {
	const [docs, setDocs] = useState<FailedDoc[]>([]);
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const load = useCallback(async () => {
		try {
			const res = await fetch("/api/documents/failed", { cache: "no-store" });
			if (!res.ok) return;
			const data = await res.json();
			setDocs(data.documents || []);
		} catch {
			// non-critical panel
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const retryAll = async () => {
		setBusy(true);
		setNote(null);
		try {
			const res = await fetch("/api/documents/failed", { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Retry failed");
			const parts = [
				data.queued && `${data.queued} queued`,
				data.failed && `${data.failed} could not be queued`,
				data.skipped && `${data.skipped} skipped (no content to render)`,
			].filter(Boolean);
			setNote(parts.join(", ") || "Nothing to retry.");
			setRefreshKey((k) => k + 1);
			await load();
		} catch (err) {
			setNote(err instanceof Error ? err.message : "Retry failed");
		} finally {
			setBusy(false);
		}
	};

	if (docs.length === 0 && !note) return null;

	return (
		<div className={className}>
			<div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-sm font-medium">
						<AlertTriangle className="h-4 w-4 text-destructive" />
						{docs.length ? `${docs.length} PDF${docs.length === 1 ? "" : "s"} need attention` : "PDF retries"}
					</div>
					{docs.length > 0 && (
						<Button size="sm" variant="outline" onClick={retryAll} disabled={busy}>
							{busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
							Retry all
						</Button>
					)}
				</div>
				{note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
				{docs.length > 0 && (
					<ul className="mt-3 space-y-2 text-sm">
						{docs.slice(0, 8).map((d) => (
							<li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
								<Link href={`/documents/${d.id}?type=${d.type}`} className="min-w-0 flex-1 truncate hover:underline" title={d.pdf_error || undefined}>
									{d.title}
									{d.company && <span className="text-muted-foreground"> · {d.company}</span>}
									{d.pdf_error && <span className="block truncate text-xs text-muted-foreground">{d.pdf_error}</span>}
								</Link>
								<PdfStatusBadge
									documentId={d.id}
									documentType={d.type}
									initial={{ pdf_status: d.pdf_status, pdf_error: d.pdf_error, pdf_url: null }}
									refreshKey={refreshKey}
								/>
							</li>
						))}
						{docs.length > 8 && <li className="text-xs text-muted-foreground">and {docs.length - 8} more</li>}
					</ul>
				)}
			</div>
		</div>
	);
}

export default FailedPdfsPanel;
