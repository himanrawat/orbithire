import { NextResponse, type NextRequest } from "next/server";
import type { JSONResume } from "@/lib/sampleResume";

export const runtime = "nodejs";

interface RenderRequest {
	resume: JSONResume;
	templateId: string;
}

// Format date helper
function formatDate(date: string): string {
	if (!date) return "";
	const d = new Date(date);
	return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/**
 * Render a JSONResume to HTML using the specified template
 * Uses jsonresume-theme-even and jsonresume-theme-elegant for npm themes
 * Uses built-in templates for others to avoid webpack bundling issues
 */
export async function POST(req: NextRequest) {
	let body: RenderRequest;
	try {
		body = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { resume, templateId } = body;

	if (!resume) {
		return NextResponse.json(
			{ error: "Resume data required" },
			{ status: 400 }
		);
	}

	try {
		let html: string;

		switch (templateId) {
			case "even": {
				// Use jsonresume-theme-even npm package
				const theme = await import("jsonresume-theme-even");
				html = theme.render(resume);
				break;
			}
			case "elegant": {
				// Use jsonresume-theme-elegant npm package
				const theme = await import("jsonresume-theme-elegant");
				html = theme.render(resume);
				break;
			}
			case "modern":
				// Built-in modern two-column template
				html = renderModernTemplate(resume);
				break;
			case "compact":
			default:
				// Built-in compact ATS-friendly template
				html = renderCompactTemplate(resume);
				break;
		}

		return NextResponse.json({ html });
	} catch (error) {
		console.error("Template render error:", error);
		// Fallback to compact template
		const html = renderCompactTemplate(resume);
		return NextResponse.json({ html });
	}
}

/**
 * Compact ATS-friendly template - single column, keyword dense
 */
function renderCompactTemplate(resume: JSONResume): string {
	const { basics, work, education, skills } = resume;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${basics.name} - Resume</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			font-size: 10pt;
			line-height: 1.4;
			color: #2d2d2d;
			padding: 0.4in;
			max-width: 8.5in;
			margin: 0 auto;
			background: #fff;
		}
		.header {
			text-align: center;
			padding-bottom: 10px;
			margin-bottom: 10px;
			border-bottom: 2px solid #2563eb;
		}
		.name { font-size: 22pt; font-weight: 700; color: #1e40af; }
		.label { font-size: 11pt; color: #4b5563; margin-top: 2px; }
		.contact {
			font-size: 9pt;
			color: #6b7280;
			margin-top: 6px;
			display: flex;
			justify-content: center;
			flex-wrap: wrap;
			gap: 4px 12px;
		}
		.section { margin: 10px 0; }
		.section-title {
			font-size: 11pt;
			font-weight: 700;
			color: #1e40af;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			padding-bottom: 3px;
			border-bottom: 1px solid #dbeafe;
			margin-bottom: 6px;
		}
		.summary { font-size: 9.5pt; color: #4b5563; }
		.job { margin-bottom: 10px; }
		.job-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 2px; flex-wrap: wrap; }
		.job-title { font-weight: 600; color: #1f2937; }
		.job-company { color: #4b5563; }
		.job-date { font-size: 9pt; color: #6b7280; }
		.highlights { padding-left: 16px; margin-top: 3px; }
		.highlights li { margin-bottom: 1px; font-size: 9.5pt; color: #374151; }
		.edu { margin-bottom: 6px; }
		.edu-main { font-weight: 600; }
		.skills-grid { display: flex; flex-wrap: wrap; gap: 6px 16px; }
		.skill-group { min-width: 180px; }
		.skill-name { font-weight: 600; font-size: 9.5pt; color: #1e40af; }
		.skill-keywords { font-size: 9pt; color: #4b5563; }
		@media print {
			body { padding: 0.25in; }
			.section { page-break-inside: avoid; }
		}
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
			${
				basics.profiles
					?.map((p) => `<span>${p.url || p.network}</span>`)
					.join("") || ""
			}
		</div>
	</div>

	${
		basics.summary
			? `
	<div class="section">
		<div class="section-title">Summary</div>
		<div class="summary">${basics.summary}</div>
	</div>
	`
			: ""
	}

	${
		skills && skills.length > 0
			? `
	<div class="section">
		<div class="section-title">Technical Skills</div>
		<div class="skills-grid">
			${skills
				.map(
					(s) => `
			<div class="skill-group">
				<span class="skill-name">${s.name}:</span>
				<span class="skill-keywords">${s.keywords?.join(", ") || ""}</span>
			</div>
			`
				)
				.join("")}
		</div>
	</div>
	`
			: ""
	}

	${
		work && work.length > 0
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
				}</span> <span class="job-company">| ${job.name}</span></span>
				<span class="job-date">${formatDate(job.startDate)} – ${
					job.endDate ? formatDate(job.endDate) : "Present"
				}</span>
			</div>
			${
				job.highlights && job.highlights.length > 0
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
		education && education.length > 0
			? `
	<div class="section">
		<div class="section-title">Education</div>
		${education
			.map(
				(edu) => `
		<div class="edu">
			<span class="edu-main">${edu.studyType || "Degree"} in ${edu.area}</span> – ${
					edu.institution
				}
			${
				edu.endDate
					? `<span class="job-date"> (${formatDate(edu.endDate)})</span>`
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
</body>
</html>`;
}

/**
 * Modern two-column template with sidebar
 */
function renderModernTemplate(resume: JSONResume): string {
	const { basics, work, education, skills } = resume;

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${basics.name} - Resume</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
			font-size: 10pt;
			line-height: 1.5;
			color: #1a1a1a;
			background: #fff;
			max-width: 8.5in;
			margin: 0 auto;
		}
		.container {
			display: grid;
			grid-template-columns: 200px 1fr;
			min-height: 11in;
		}
		.sidebar {
			background: linear-gradient(180deg, #1e293b 0%, #334155 100%);
			color: #fff;
			padding: 24px 16px;
		}
		.main {
			padding: 24px;
		}
		.photo-placeholder {
			width: 80px;
			height: 80px;
			border-radius: 50%;
			background: #475569;
			margin: 0 auto 16px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 24pt;
			color: #94a3b8;
		}
		.sidebar-name {
			font-size: 14pt;
			font-weight: 700;
			text-align: center;
			margin-bottom: 4px;
		}
		.sidebar-label {
			font-size: 9pt;
			text-align: center;
			color: #94a3b8;
			margin-bottom: 20px;
		}
		.sidebar-section {
			margin-bottom: 16px;
		}
		.sidebar-title {
			font-size: 8pt;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 1px;
			color: #94a3b8;
			margin-bottom: 8px;
			padding-bottom: 4px;
			border-bottom: 1px solid #475569;
		}
		.contact-item {
			font-size: 8pt;
			margin-bottom: 4px;
			color: #e2e8f0;
			word-break: break-all;
		}
		.skill-tag {
			display: inline-block;
			background: #475569;
			color: #e2e8f0;
			padding: 2px 6px;
			border-radius: 3px;
			font-size: 7pt;
			margin: 2px 2px 2px 0;
		}
		.main-name {
			font-size: 28pt;
			font-weight: 700;
			color: #0f172a;
			letter-spacing: -0.5px;
		}
		.main-label {
			font-size: 12pt;
			color: #64748b;
			margin-bottom: 16px;
		}
		.summary {
			color: #475569;
			margin-bottom: 20px;
			font-size: 10pt;
			line-height: 1.6;
		}
		.section {
			margin-bottom: 20px;
		}
		.section-title {
			font-size: 11pt;
			font-weight: 700;
			color: #0f172a;
			text-transform: uppercase;
			letter-spacing: 1px;
			padding-bottom: 6px;
			border-bottom: 2px solid #3b82f6;
			margin-bottom: 12px;
		}
		.job {
			margin-bottom: 14px;
		}
		.job-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			margin-bottom: 4px;
			flex-wrap: wrap;
		}
		.job-title {
			font-weight: 600;
			font-size: 11pt;
			color: #0f172a;
		}
		.job-company {
			color: #3b82f6;
			font-weight: 500;
		}
		.job-date {
			font-size: 9pt;
			color: #64748b;
		}
		.highlights {
			padding-left: 16px;
			margin-top: 4px;
		}
		.highlights li {
			margin-bottom: 2px;
			font-size: 9.5pt;
			color: #334155;
		}
		.edu {
			margin-bottom: 10px;
		}
		.edu-degree {
			font-weight: 600;
			color: #0f172a;
		}
		.edu-school {
			color: #64748b;
			font-size: 9pt;
		}
		@media print {
			.container { min-height: auto; }
			.sidebar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="sidebar">
			<div class="photo-placeholder">${basics.name?.charAt(0) || "?"}</div>
			<div class="sidebar-name">${basics.name}</div>
			${basics.label ? `<div class="sidebar-label">${basics.label}</div>` : ""}
			
			<div class="sidebar-section">
				<div class="sidebar-title">Contact</div>
				${basics.email ? `<div class="contact-item">📧 ${basics.email}</div>` : ""}
				${basics.phone ? `<div class="contact-item">📱 ${basics.phone}</div>` : ""}
				${
					basics.location?.city
						? `<div class="contact-item">📍 ${basics.location.city}${
								basics.location.region ? `, ${basics.location.region}` : ""
						  }</div>`
						: ""
				}
				${basics.url ? `<div class="contact-item">🌐 ${basics.url}</div>` : ""}
				${
					basics.profiles
						?.map(
							(p) =>
								`<div class="contact-item">${p.network}: ${
									p.username || p.url
								}</div>`
						)
						.join("") || ""
				}
			</div>
			
			${
				skills && skills.length > 0
					? `
			<div class="sidebar-section">
				<div class="sidebar-title">Skills</div>
				${skills
					.map(
						(s) => `
				<div style="margin-bottom: 8px;">
					<div style="font-size: 8pt; color: #94a3b8; margin-bottom: 2px;">${s.name}</div>
					<div>${
						s.keywords
							?.map((k) => `<span class="skill-tag">${k}</span>`)
							.join("") || ""
					}</div>
				</div>
				`
					)
					.join("")}
			</div>
			`
					: ""
			}
		</div>
		
		<div class="main">
			<div class="main-name">${basics.name}</div>
			${basics.label ? `<div class="main-label">${basics.label}</div>` : ""}
			
			${basics.summary ? `<div class="summary">${basics.summary}</div>` : ""}
			
			${
				work && work.length > 0
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
						}</span> <span class="job-company">@ ${job.name}</span></span>
						<span class="job-date">${formatDate(job.startDate)} – ${
							job.endDate ? formatDate(job.endDate) : "Present"
						}</span>
					</div>
					${
						job.highlights && job.highlights.length > 0
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
				education && education.length > 0
					? `
			<div class="section">
				<div class="section-title">Education</div>
				${education
					.map(
						(edu) => `
				<div class="edu">
					<div class="edu-degree">${edu.studyType || "Degree"} in ${edu.area}</div>
					<div class="edu-school">${edu.institution}${
							edu.endDate ? ` • ${formatDate(edu.endDate)}` : ""
						}</div>
				</div>
				`
					)
					.join("")}
			</div>
			`
					: ""
			}
		</div>
	</div>
</body>
</html>`;
}
