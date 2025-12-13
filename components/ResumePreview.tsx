"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JSONResume } from "@/lib/sampleResume";
import { sampleResume } from "@/lib/sampleResume";
import Image from "next/image";

export interface ResumeTemplate {
	id: string;
	name: string;
	style: string;
	description: string;
	tags: string[];
	previewHtml: string;
}

interface ResumePreviewProps {
	resume: JSONResume;
	templateId: string;
	isOpen: boolean;
	onClose: () => void;
}

/**
 * Check if two JSONResume objects are the same (for sample data detection)
 */
function isSampleResume(resume: JSONResume): boolean {
	return (
		resume.basics?.name === sampleResume.basics?.name &&
		resume.basics?.email === sampleResume.basics?.email
	);
}

/**
 * Full-screen resume preview modal
 */
export function ResumePreview({
	resume,
	templateId,
	isOpen,
	onClose,
}: ResumePreviewProps) {
	const [html, setHtml] = useState<string>("");
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [useThumbnail, setUseThumbnail] = useState(false);
	const [loading, setLoading] = useState(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		if (!isOpen) return;

		async function renderResume() {
			setLoading(true);
			setPreviewUrl(null);
			setUseThumbnail(false);

			try {
				// Check if this is sample data - use cached thumbnail image
				if (isSampleResume(resume)) {
					// Use the thumbnail API which returns a high-res image
					setPreviewUrl(`/api/template/thumbnail/${templateId}`);
					setUseThumbnail(true);
					setLoading(false);
					return;
				}

				// For custom resume data, render dynamically
				const response = await fetch("/api/resume/render", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ resume, templateId }),
				});

				if (response.ok) {
					const data = await response.json();
					setHtml(data.html);
				} else {
					// Fallback to basic HTML rendering
					setHtml(renderBasicHtml(resume));
				}
			} catch {
				setHtml(renderBasicHtml(resume));
			} finally {
				setLoading(false);
			}
		}

		renderResume();
	}, [isOpen, resume, templateId]);

	const handlePrint = () => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.print();
		}
	};

	if (!isOpen) return null;

	return (
		<motion.div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
		>
			<motion.div
				className="relative flex h-[90vh] w-[90vw] max-w-5xl flex-col rounded-xl bg-white shadow-2xl"
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b px-6 py-4">
					<h2 className="text-lg font-semibold text-gray-900">
						Resume Preview
					</h2>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handlePrint}
							className="text-gray-700"
							disabled={useThumbnail}
						>
							<Printer className="mr-2 h-4 w-4" />
							Print
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={onClose}
							className="text-gray-500 hover:text-gray-700"
						>
							<X className="h-5 w-5" />
						</Button>
					</div>
				</div>

				{/* Preview content */}
				<div className="flex-1 overflow-auto bg-gray-100 p-4">
					{loading ? (
						<div className="flex h-full items-center justify-center">
							<Loader2 className="h-8 w-8 animate-spin text-gray-400" />
						</div>
					) : useThumbnail && previewUrl ? (
						<div className="mx-auto flex h-full items-center justify-center">
							<div className="relative aspect-[8.5/11] h-full max-h-full overflow-hidden rounded-lg bg-white shadow-lg">
								<Image
									src={previewUrl}
									alt={`${templateId} template preview`}
									fill
									className="object-contain"
									unoptimized
								/>
							</div>
						</div>
					) : (
						<div className="mx-auto aspect-[8.5/11] h-full max-h-full overflow-hidden rounded-lg bg-white shadow-lg">
							<iframe
								ref={iframeRef}
								srcDoc={html}
								className="h-full w-full border-0"
								title="Resume Preview"
							/>
						</div>
					)}
				</div>
			</motion.div>
		</motion.div>
	);
}

/**
 * Fallback basic HTML renderer
 */
function renderBasicHtml(resume: JSONResume): string {
	const { basics, work, education, skills } = resume;

	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: 'Georgia', serif;
			font-size: 11pt;
			line-height: 1.5;
			color: #333;
			padding: 0.5in;
			max-width: 8.5in;
		}
		.header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 12px; }
		.name { font-size: 24pt; font-weight: bold; color: #1a1a1a; }
		.label { font-size: 12pt; color: #666; margin-top: 4px; }
		.contact { font-size: 9pt; color: #555; margin-top: 8px; }
		.contact span { margin: 0 8px; }
		.section { margin: 16px 0; }
		.section-title { font-size: 12pt; font-weight: bold; color: #1a1a1a; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
		.summary { font-size: 10pt; color: #444; }
		.job { margin-bottom: 12px; }
		.job-header { display: flex; justify-content: space-between; align-items: baseline; }
		.job-title { font-weight: bold; }
		.job-company { font-style: italic; }
		.job-date { font-size: 9pt; color: #666; }
		.highlights { margin-top: 4px; padding-left: 20px; }
		.highlights li { margin-bottom: 2px; font-size: 10pt; }
		.edu { margin-bottom: 8px; }
		.skills-grid { display: flex; flex-wrap: wrap; gap: 8px; }
		.skill-group { flex: 1; min-width: 200px; }
		.skill-name { font-weight: bold; font-size: 10pt; }
		.skill-keywords { font-size: 9pt; color: #555; }
	</style>
</head>
<body>
	<div class="header">
		<div class="name">${basics.name}</div>
		${basics.label ? `<div class="label">${basics.label}</div>` : ""}
		<div class="contact">
			${basics.email ? `<span>${basics.email}</span>` : ""}
			${basics.phone ? `<span>${basics.phone}</span>` : ""}
			${
				basics.location?.city
					? `<span>${basics.location.city}${
							basics.location.region ? `, ${basics.location.region}` : ""
					  }</span>`
					: ""
			}
			${basics.url ? `<span>${basics.url}</span>` : ""}
		</div>
	</div>

	${
		basics.summary
			? `
	<div class="section">
		<div class="section-title">Professional Summary</div>
		<div class="summary">${basics.summary}</div>
	</div>
	`
			: ""
	}

	${
		work.length > 0
			? `
	<div class="section">
		<div class="section-title">Experience</div>
		${work
			.map(
				(job) => `
		<div class="job">
			<div class="job-header">
				<span><span class="job-title">${
					job.position
				}</span> at <span class="job-company">${job.name}</span></span>
				<span class="job-date">${job.startDate} - ${job.endDate || "Present"}</span>
			</div>
			${
				job.highlights.length > 0
					? `
			<ul class="highlights">
				${job.highlights.map((h) => `<li>${h}</li>`).join("")}
			</ul>
			`
					: ""
			}
		</div>
		`
			)
			.join("")}
	</div>
	`
			: ""
	}

	${
		education.length > 0
			? `
	<div class="section">
		<div class="section-title">Education</div>
		${education
			.map(
				(edu) => `
		<div class="edu">
			<strong>${edu.studyType} in ${edu.area}</strong> - ${edu.institution}
			<span class="job-date">(${edu.endDate || edu.startDate})</span>
		</div>
		`
			)
			.join("")}
	</div>
	`
			: ""
	}

	${
		skills.length > 0
			? `
	<div class="section">
		<div class="section-title">Skills</div>
		<div class="skills-grid">
			${skills
				.map(
					(s) => `
			<div class="skill-group">
				<span class="skill-name">${s.name}:</span>
				<span class="skill-keywords">${s.keywords.join(", ")}</span>
			</div>
			`
				)
				.join("")}
		</div>
	</div>
	`
			: ""
	}
</body>
</html>
	`;
}

export default ResumePreview;
