"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateGallery } from "@/components/TemplateGallery";
import { HTML_TEMPLATES, type TemplateInfo } from "@/lib/templateCatalog";

/** Template gallery: Typst templates (resume + cover letter) and the legacy Classic (HTML) ones. */
export default function TemplatesPage() {
	const [templates, setTemplates] = useState<TemplateInfo[] | null>(null);
	const [selected, setSelected] = useState("");

	useEffect(() => {
		fetch("/api/templates")
			.then((r) => (r.ok ? r.json() : { templates: HTML_TEMPLATES }))
			.then((d) => setTemplates(d.templates))
			.catch(() => setTemplates(HTML_TEMPLATES));
	}, []);

	if (!templates) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	const asGallery = (list: TemplateInfo[]) => list.map((t) => ({ ...t, id: t.key }));
	const typstResumes = templates.filter((t) => t.engine === "typst" && t.kind === "resume");
	const typstLetters = templates.filter((t) => t.engine === "typst" && t.kind === "cover_letter");
	const html = templates.filter((t) => t.engine === "html");
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
						Typst templates render fast, ATS-checked PDFs in the background. Classic (HTML) templates are
						kept until the Typst set fully replaces them.
					</p>
				</div>
				<Button asChild>
					<Link href="/generate">
						<Sparkles className="mr-2 h-4 w-4" />
						Generate a resume
					</Link>
				</Button>
			</div>
			<TemplateGallery title="Typst resume templates" templates={asGallery(typstResumes)} selectedId={selected} onSelect={setSelected} onPreview={open} />
			<TemplateGallery title="Typst cover letter templates" templates={asGallery(typstLetters)} selectedId={selected} onSelect={setSelected} onPreview={open} />
			<TemplateGallery title="Classic (HTML) templates" templates={asGallery(html)} selectedId={selected} onSelect={setSelected} />
		</div>
	);
}
