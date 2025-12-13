"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumeTemplate } from "@/components/ResumePreview";

export interface TemplateGalleryProps {
	readonly templates: ResumeTemplate[];
	readonly selectedId: string;
	readonly onSelect: (templateId: string) => void;
	readonly onPreview?: (templateId: string) => void;
}

export function TemplateGallery({
	templates,
	selectedId,
	onSelect,
	onPreview,
}: TemplateGalleryProps) {
	const [hoveredId, setHoveredId] = useState<string | null>(null);
	const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
	const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

	const handleImageLoad = (templateId: string) => {
		setLoadedImages((prev) => new Set(prev).add(templateId));
	};

	const handleImageError = (templateId: string) => {
		setFailedImages((prev) => new Set(prev).add(templateId));
		// Also mark as "loaded" to stop showing spinner
		setLoadedImages((prev) => new Set(prev).add(templateId));
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-2">
				<h3 className="text-lg font-semibold">Choose a Template</h3>
				<p className="text-sm text-muted-foreground">
					Click to select • Hover for full preview
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{templates.map((template) => {
					const isSelected = template.id === selectedId;
					const isHovered = template.id === hoveredId;
					const isLoaded = loadedImages.has(template.id);
					const hasFailed = failedImages.has(template.id);

					return (
						<motion.div
							key={template.id}
							className={cn(
								"group relative cursor-pointer rounded-xl border-2 bg-card transition-all duration-200",
								isSelected
									? "border-primary shadow-lg shadow-primary/20"
									: "border-border hover:border-primary/50"
							)}
							onClick={() => onSelect(template.id)}
							onMouseEnter={() => setHoveredId(template.id)}
							onMouseLeave={() => setHoveredId(null)}
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
						>
							{/* Selected indicator */}
							{isSelected && (
								<div className="absolute -right-2 -top-2 z-10 rounded-full bg-primary p-1">
									<CheckCircle2 className="h-4 w-4 text-primary-foreground" />
								</div>
							)}

							{/* Preview thumbnail - static image from R2 */}
							<div className="relative aspect-[8.5/11] overflow-hidden rounded-t-lg bg-white">
								{/* Loading spinner - shown until image loads */}
								{!isLoaded && (
									<div className="absolute inset-0 flex items-center justify-center">
										<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
									</div>
								)}

								{/* Fallback for failed images */}
								{hasFailed && (
									<div className="absolute inset-0 flex items-center justify-center bg-muted">
										<span className="text-xs text-muted-foreground">
											Preview unavailable
										</span>
									</div>
								)}

								{/* Static thumbnail image */}
								{!hasFailed && (
									<Image
										src={`/api/template/thumbnail/${template.id}`}
										alt={`${template.name} template preview`}
										fill
										className={cn(
											"object-cover object-top transition-opacity",
											isLoaded ? "opacity-100" : "opacity-0"
										)}
										onLoad={() => handleImageLoad(template.id)}
										onError={() => handleImageError(template.id)}
										unoptimized // Using external R2 URL via redirect
									/>
								)}

								{/* Hover overlay with preview button */}
								{isHovered && onPreview && isLoaded && !hasFailed && (
									<motion.div
										className="absolute inset-0 flex items-center justify-center bg-black/50"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										<button
											onClick={(e) => {
												e.stopPropagation();
												onPreview(template.id);
											}}
											className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-lg transition hover:bg-gray-100"
										>
											<Eye className="h-4 w-4" />
											Full Preview
										</button>
									</motion.div>
								)}
							</div>

							{/* Template info */}
							<div className="space-y-2 p-3">
								<div className="flex items-center justify-between">
									<h4 className="font-semibold text-sm">{template.name}</h4>
									<span className="rounded-full bg-muted px-2 py-0.5 text-xs">
										{template.style}
									</span>
								</div>
								<p className="text-xs text-muted-foreground line-clamp-2">
									{template.description}
								</p>
								<div className="flex flex-wrap gap-1">
									{template.tags.slice(0, 3).map((tag: string) => (
										<span
											key={tag}
											className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
										>
											{tag}
										</span>
									))}
								</div>
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}

export default TemplateGallery;
