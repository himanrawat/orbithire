"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentType, PdfStatus } from "@/lib/types/database";

export interface PdfStatusInfo {
	pdf_status: PdfStatus;
	pdf_error: string | null;
	pdf_url: string | null;
	engine?: string;
	/** Last change of the row; used to offer a retry for renders that look stuck. */
	updated_at?: string | null;
}

interface PdfStatusBadgeProps {
	documentId: string;
	documentType: DocumentType;
	initial?: Partial<PdfStatusInfo>;
	/** Called whenever a new status arrives (e.g. to refresh the PDF link). */
	onChange?: (status: PdfStatusInfo) => void;
	/** Bump to force an immediate refresh (e.g. after saving). */
	refreshKey?: number;
	className?: string;
	showRetry?: boolean;
}

const POLL_MS = 2000;
/** Same threshold as POST /api/documents/:id/retry, which re-queues renders older than this. */
const STUCK_MS = 120_000;

const STYLES: Record<PdfStatus, { label: string; cls: string }> = {
	none: { label: "No PDF", cls: "bg-muted text-muted-foreground" },
	queued: { label: "Queued", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
	rendering: { label: "Rendering", cls: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
	ready: { label: "PDF ready", cls: "bg-green-500/10 text-green-700 dark:text-green-300" },
	failed: { label: "PDF failed", cls: "bg-destructive/10 text-destructive" },
};

/**
 * PDF status badge (queued / rendering / ready / failed + retry).
 * Polls GET /api/documents/:id/status every 2 s while queued or rendering.
 */
export function PdfStatusBadge({
	documentId,
	documentType,
	initial,
	onChange,
	refreshKey,
	className,
	showRetry = true,
}: PdfStatusBadgeProps) {
	const [status, setStatus] = useState<PdfStatusInfo>({
		pdf_status: initial?.pdf_status ?? "none",
		pdf_error: initial?.pdf_error ?? null,
		pdf_url: initial?.pdf_url ?? null,
		engine: initial?.engine,
		updated_at: initial?.updated_at ?? null,
	});
	const [retrying, setRetrying] = useState(false);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const statusRef = useRef(status);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await fetch(`/api/documents/${documentId}/status?type=${documentType}`, { cache: "no-store" });
			if (!res.ok) return;
			const data = await res.json();
			const next: PdfStatusInfo = {
				pdf_status: data.pdf_status,
				pdf_error: data.pdf_error,
				pdf_url: data.pdf_url,
				engine: data.engine,
				updated_at: data.updated_at ?? null,
			};
			const prev = statusRef.current;
			if (
				prev.pdf_status !== next.pdf_status ||
				prev.pdf_url !== next.pdf_url ||
				prev.pdf_error !== next.pdf_error
			) {
				onChangeRef.current?.(next);
			}
			statusRef.current = next;
			setStatus(next);
		} catch {
			// network hiccup: keep polling
		}
	}, [documentId, documentType]);

	useEffect(() => {
		if (refreshKey !== undefined) void fetchStatus();
	}, [refreshKey, fetchStatus]);

	const active = status.pdf_status === "queued" || status.pdf_status === "rendering";
	useEffect(() => {
		if (!active) return;
		const t = setInterval(fetchStatus, POLL_MS);
		return () => clearInterval(t);
	}, [active, fetchStatus]);

	const retry = async () => {
		setRetrying(true);
		try {
			const res = await fetch(`/api/documents/${documentId}/retry?type=${documentType}`, { method: "POST" });
			const data = await res.json().catch(() => ({}));
			if (data?.status) {
				const next = {
					pdf_status: data.status.pdf_status,
					pdf_error: data.status.pdf_error,
					pdf_url: data.status.pdf_url,
					engine: data.status.engine,
					updated_at: data.status.updated_at ?? null,
				};
				statusRef.current = next;
				setStatus(next);
				onChangeRef.current?.(next);
			} else {
				await fetchStatus();
			}
		} finally {
			setRetrying(false);
		}
	};

	const style = STYLES[status.pdf_status] ?? STYLES.none;
	const Icon =
		status.pdf_status === "ready"
			? CheckCircle2
			: status.pdf_status === "failed"
				? AlertTriangle
				: status.pdf_status === "rendering"
					? Loader2
					: Clock;
	const retryingNote = status.pdf_status === "queued" && status.pdf_error;
	const stuck =
		active && !!status.updated_at && Date.now() - new Date(status.updated_at).getTime() > STUCK_MS;
	const canRetry = status.pdf_status === "failed" || status.pdf_status === "none" || stuck;

	return (
		<span className={cn("inline-flex items-center gap-1.5", className)}>
			<span
				className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", style.cls)}
				title={status.pdf_error || undefined}
				data-pdf-status={status.pdf_status}
			>
				<Icon className={cn("h-3 w-3", status.pdf_status === "rendering" && "animate-spin")} />
				{retryingNote ? "Retrying" : style.label}
			</span>
			{showRetry && canRetry && (
				<button
					type="button"
					onClick={retry}
					disabled={retrying}
					className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
					title={
						status.pdf_status === "failed"
							? `Retry: ${status.pdf_error ?? ""}`
							: stuck
								? "This render is taking unusually long – queue it again"
								: "Render PDF"
					}
				>
					{retrying ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
					{status.pdf_status === "failed" || stuck ? "Retry" : "Render"}
				</button>
			)}
		</span>
	);
}

export default PdfStatusBadge;
