"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TypstPreview } from "@/components/TypstPreview";
import { diffDocuments } from "@/lib/documentDiff";
import { cn } from "@/lib/utils";
import type { DocumentType } from "@/lib/types/database";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface VersionRow {
	id: string;
	version: number;
	source: "portal" | "mcp" | "import";
	created_at: string;
}

interface VersionHistoryProps {
	documentId: string;
	documentType: DocumentType;
	engine: "typst" | "html";
	templateId: string;
	paper?: "a4" | "letter";
	/** Content currently in the editor (diffs are shown against it). */
	currentContent: Record<string, any>;
	/** Bump after a save so the list reloads. */
	refreshKey?: number;
	/** Called with the updated document row after a restore. */
	onRestored: (document: Record<string, any> | null, message: string) => void;
}

const SOURCE_LABEL: Record<string, string> = { portal: "Portal", mcp: "AI (MCP)", import: "Import" };

/**
 * Version history for the document editor: list, preview, diff against the
 * editor, restore (= new version + re-render; old versions are never changed).
 */
export function VersionHistory({
	documentId,
	documentType,
	engine,
	templateId,
	paper,
	currentContent,
	refreshKey,
	onRestored,
}: VersionHistoryProps) {
	const [open, setOpen] = useState(false);
	const [versions, setVersions] = useState<VersionRow[] | null>(null);
	const [selected, setSelected] = useState<{ version: number; content: Record<string, any> } | null>(null);
	const [loading, setLoading] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/documents/${documentId}/versions?type=${documentType}`, { cache: "no-store" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not load versions");
			setVersions(data.versions);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load versions");
		} finally {
			setLoading(false);
		}
	}, [documentId, documentType]);

	useEffect(() => {
		if (open) void load();
	}, [open, load, refreshKey]);

	const select = async (version: number) => {
		if (selected?.version === version) {
			setSelected(null);
			return;
		}
		setError(null);
		try {
			const res = await fetch(`/api/documents/${documentId}/versions/${version}?type=${documentType}`, { cache: "no-store" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Could not load the version");
			setSelected({ version, content: data.content_json || {} });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load the version");
		}
	};

	const restore = async () => {
		if (!selected) return;
		if (!window.confirm(`Restore version ${selected.version}? It is saved as a new version and the PDF is re-rendered. Unsaved edits in the form are replaced.`)) return;
		setRestoring(true);
		setError(null);
		try {
			const res = await fetch(`/api/documents/${documentId}/versions/${selected.version}?type=${documentType}`, { method: "POST" });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Restore failed");
			onRestored(
				data.document,
				`Restored version ${data.restored_from} as version ${data.version ?? "?"}. ${
					engine === "typst" ? "The PDF is rendering in the background." : data.render?.ok ? "PDF rendered." : `PDF failed: ${data.render?.error ?? "unknown error"}`
				}`
			);
			setSelected(null);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Restore failed");
		} finally {
			setRestoring(false);
		}
	};

	// What restoring would change, relative to what is in the editor now.
	const diff = useMemo(() => (selected ? diffDocuments(currentContent, selected.content) : []), [selected, currentContent]);
	const latest = versions?.[0]?.version;

	return (
		<Card className="border-border/50 bg-card/80">
			<CardHeader className="pb-3">
				<button type="button" className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
					<div>
						<CardTitle className="flex items-center gap-2 text-base">
							<History className="h-4 w-4" /> Version history
						</CardTitle>
						<CardDescription>Every save is a version. Restoring creates a new version.</CardDescription>
					</div>
					{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
				</button>
			</CardHeader>
			{open && (
				<CardContent className="space-y-3">
					{error && <div className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">{error}</div>}
					{loading && !versions && <Loader2 className="h-4 w-4 animate-spin" />}
					{versions && versions.length === 0 && <p className="text-sm text-muted-foreground">No saved versions yet. Saving creates version 1.</p>}
					{versions && versions.length > 0 && (
						<ul className="max-h-64 divide-y overflow-auto rounded border text-sm">
							{versions.map((v) => (
								<li key={v.id}>
									<button
										type="button"
										onClick={() => select(v.version)}
										className={cn("flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted", selected?.version === v.version && "bg-muted")}
									>
										<span className="w-10 font-mono text-xs">v{v.version}</span>
										<Badge variant="outline" className="text-[10px]">
											{SOURCE_LABEL[v.source] ?? v.source}
										</Badge>
										<span className="flex-1 text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</span>
										{v.version === latest && <span className="text-[10px] text-muted-foreground">latest</span>}
									</button>
								</li>
							))}
						</ul>
					)}
					{selected && (
						<div className="space-y-3 rounded border p-3">
							<div className="flex items-center justify-between gap-2">
								<span className="text-sm font-medium">Version {selected.version}</span>
								<Button size="sm" variant="outline" onClick={restore} disabled={restoring}>
									{restoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RotateCcw className="mr-1 h-3 w-3" />}
									Restore
								</Button>
							</div>
							<div className="space-y-2">
								<p className="text-xs font-medium text-muted-foreground">Changes compared with the editor</p>
								{diff.length === 0 ? (
									<p className="text-xs text-muted-foreground">Same content as the editor.</p>
								) : (
									<ul className="max-h-64 space-y-2 overflow-auto text-xs">
										{diff.map((d) => (
											<li key={d.section}>
												<span className="font-medium">{d.section}</span>{" "}
												<span className="text-muted-foreground">({d.status})</span>
												{d.removed.slice(0, 8).map((l, i) => (
													<div key={`r${i}`} className="whitespace-pre-wrap text-destructive">
														− {l}
													</div>
												))}
												{d.added.slice(0, 8).map((l, i) => (
													<div key={`a${i}`} className="whitespace-pre-wrap text-green-700 dark:text-green-400">
														+ {l}
													</div>
												))}
												{d.added.length + d.removed.length > 16 && <div className="text-muted-foreground">…</div>}
											</li>
										))}
									</ul>
								)}
								<p className="text-[10px] text-muted-foreground">− in the editor now · + in version {selected.version}</p>
							</div>
							{engine === "typst" ? (
								<TypstPreview documentId={documentId} templateId={templateId} data={selected.content} accent={selected.content?.meta?.accent ?? null} paper={selected.content?.meta?.paper ?? paper ?? null} />
							) : (
								<p className="text-xs text-muted-foreground">Classic (HTML) templates have no live preview; restore to render the PDF.</p>
							)}
						</div>
					)}
				</CardContent>
			)}
		</Card>
	);
}

export default VersionHistory;
