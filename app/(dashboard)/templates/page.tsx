"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateGallery } from "@/components/TemplateGallery";
import type { TemplateInfo } from "@/lib/templateCatalog";

/** Template gallery: Typst resume and cover letter templates. */
export default function TemplatesPage() {
	const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
	const [selected, setSelected] = useState("");

	useEffect(() => {
		fetch("/api/templates")
			.then((r) => (r.ok ? r.json() : { templates: [] }))
			.then((d) => setTemplates(d.templates ?? []))
			.catch(() => setTemplates([]));
	}, []);

	if (!templates) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const asGallery = (list: TemplateInfo[]) => list.map((t) => ({ ...t, id: t.key }));
	const resumes = templates.filter((t) => t.kind === "resume");
	const letters = templates.filter((t) => t.kind === "cover_letter");
	const open = (key: string) => {
		const t = templates.find((x) => x.key === key);
		if (t) window.open(t.thumbnailUrl, "_blank");
	};

	return (
		<div className="container mx-auto max-w-6xl space-y-10 px-4 py-8">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold">Templates</h1>
					<p className="mt-1 text-muted-foreground">
						Every template renders a fast, ATS-checked PDF in the background. Pick one when you generate a
						resume or cover letter, or switch templates any time in the document editor.
					</p>
				</div>
				<Button asChild>
					<Link href="/generate">
						<Sparkles className="mr-2 h-4 w-4" />
						Generate a resume
					</Link>
				</Button>
			</div>
			<TemplateGallery title="Resume templates" templates={asGallery(resumes)} selectedId={selected} onSelect={setSelected} onPreview={open} />
			<TemplateGallery title="Cover letter templates" templates={asGallery(letters)} selectedId={selected} onSelect={setSelected} onPreview={open} />
		</div>
	);
}
