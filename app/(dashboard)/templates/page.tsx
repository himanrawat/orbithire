"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateGallery } from "@/components/TemplateGallery";
import { PageHeader } from "@/components/app/page-header";
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
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
		<div className="mx-auto max-w-6xl space-y-10 px-4 py-8 md:px-8">
			<PageHeader
				icon={<LayoutTemplate />}
				title="Templates"
				description="Every template renders a fast, ATS-checked PDF in the background. Pick one when you generate a resume or cover letter, or switch any time in the document editor."
				actions={
					<Button variant="cap" asChild>
						<Link href="/generate">
							<Sparkles className="h-4 w-4" />
							Generate a resume
						</Link>
					</Button>
				}
				className="mb-0"
			/>
			<TemplateGallery title="Resume templates" templates={asGallery(resumes)} selectedId={selected} onSelect={setSelected} onPreview={open} />
			<TemplateGallery title="Cover letter templates" templates={asGallery(letters)} selectedId={selected} onSelect={setSelected} onPreview={open} />
		</div>
	);
}
