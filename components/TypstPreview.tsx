"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TypstPreviewProps {
	/** Saved document id, or "new" for unsaved content. */
	documentId?: string;
	templateId: string;
	data: unknown;
	accent?: string | null;
	paper?: "a4" | "letter" | null;
	debounceMs?: number;
	className?: string;
}

/**
 * Live page-1 preview rendered by the worker (POST /api/documents/:id/preview),
 * debounced while the user types. Keeps the last good image on errors.
 */
export function TypstPreview({
	documentId = "new",
	templateId,
	data,
	accent,
	paper,
	debounceMs = 400,
	className,
}: Readonly<TypstPreviewProps>) {
	const [src, setSrc] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [info, setInfo] = useState<{ pages: number; ms: number } | null>(null);
	const urlRef = useRef<string | null>(null);
	const body = JSON.stringify({ template_id: templateId, data, accent: accent || undefined, paper: paper || undefined });

	useEffect(() => {
		const ctrl = new AbortController();
		const t = setTimeout(async () => {
			setLoading(true);
			const started = performance.now();
			try {
				const res = await fetch(`/api/documents/${documentId}/preview`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body,
					signal: ctrl.signal,
				});
				if (!res.ok) {
					const err = await res.json().catch(() => ({}));
					throw new Error(err.error || `Preview failed (${res.status})`);
				}
				const blob = await res.blob();
				const url = URL.createObjectURL(blob);
				if (urlRef.current) URL.revokeObjectURL(urlRef.current);
				urlRef.current = url;
				setSrc(url);
				setError(null);
				setInfo({
					pages: Number(res.headers.get("x-page-count") || 1),
					ms: Math.round(performance.now() - started),
				});
			} catch (err) {
				if ((err as Error).name === "AbortError") return;
				setError(err instanceof Error ? err.message : "Preview failed");
			} finally {
				if (!ctrl.signal.aborted) setLoading(false);
			}
		}, debounceMs);
		return () => {
			clearTimeout(t);
			ctrl.abort();
		};
	}, [body, documentId, debounceMs]);

	useEffect(
		() => () => {
			if (urlRef.current) URL.revokeObjectURL(urlRef.current);
		},
		[]
	);

	return (
		<div className={cn("relative", className)}>
			<div className="relative overflow-hidden rounded-lg border bg-white shadow-sm" style={{ aspectRatio: paper === "letter" ? "8.5 / 11" : "210 / 297" }}>
				{src ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={src} alt="Live preview of page 1" className="h-full w-full object-contain object-top" />
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{error ? "Preview unavailable" : <Loader2 className="h-6 w-6 animate-spin" />}
					</div>
				)}
				{loading && src && (
					<div className="absolute right-2 top-2 rounded-full bg-background/80 p-1 shadow">
						<Loader2 className="h-4 w-4 animate-spin" />
					</div>
				)}
			</div>
			<div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
				<span>
					Page 1{info && info.pages > 1 ? ` of ${info.pages}` : ""}
				</span>
				{info && <span>{info.ms} ms</span>}
			</div>
			{error && (
				<p className="mt-1 flex items-start gap-1 text-xs text-destructive">
					<AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
					<span className="line-clamp-3">{error}</span>
				</p>
			)}
		</div>
	);
}

export default TypstPreview;
