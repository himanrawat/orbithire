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

// Render projects section helper - reusable across templates
function renderProjectsSection(
	projects: JSONResume["projects"],
	style: "compact" | "modern" | "standard" = "compact"
): string {
	if (!projects || projects.length === 0) return "";

	const projectItems = projects
		.map((project) => {
			const highlights =
				project.highlights && project.highlights.length > 0
					? `<ul class="highlights">${project.highlights
							.map((h) => `<li>${h}</li>`)
							.join("")}</ul>`
					: project.description
					? `<p class="project-desc">${project.description}</p>`
					: "";

			return `
		<div class="project">
			<div class="project-header">
				<span class="project-name">${project.name}</span>
				${
					project.url
						? `<a href="${project.url}" class="project-link">${project.url}</a>`
						: ""
				}
			</div>
			${highlights}
		</div>`;
		})
		.join("");

	return `
	<div class="section">
		<${style === "compact" ? "div" : "h3"} class="section-title">Projects</${
		style === "compact" ? "div" : "h3"
	}>
		${projectItems}
	</div>`;
}

/**
 * Render a JSONResume to HTML using built-in templates
 * NPM themes (jsonresume-theme-*) have bundling issues with Next.js
 * All templates are now implemented as built-in functions
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
			case "standard":
				html = renderStandardTemplate(resume);
				break;
			case "professional":
				html = renderProfessionalTemplate(resume);
				break;
			case "even":
				html = renderEvenTemplate(resume);
				break;
			case "elegant":
				html = renderElegantTemplate(resume);
				break;
			case "flat":
				html = renderFlatTemplate(resume);
				break;
			case "spartacus":
				html = renderSpartacusTemplate(resume);
				break;
			case "paper":
				html = renderPaperTemplate(resume);
				break;
			case "modern":
				html = renderModernTemplate(resume);
				break;
			case "compact":
			default:
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

	${
		resume.projects && resume.projects.length > 0
			? `
	<div class="section">
		<div class="section-title">Projects</div>
		${resume.projects
			.map(
				(project) => `
		<div class="job">
			<div class="job-header">
				<span class="job-title">${project.name}</span>
			</div>
			${
				project.highlights && project.highlights.length > 0
					? `
			<ul class="highlights">
				${project.highlights.map((h) => `<li>${h}</li>`).join("")}
			</ul>
			`
					: project.description
					? `<p class="summary" style="margin-top: 3px;">${project.description}</p>`
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
		.profile-photo {
			width: 80px;
			height: 80px;
			border-radius: 50%;
			margin: 0 auto 16px;
			object-fit: cover;
			border: 2px solid #475569;
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
			${basics.image 
				? `<img src="${basics.image}" alt="${basics.name}" class="profile-photo" />`
				: `<div class="photo-placeholder">${basics.name?.charAt(0) || "?"}</div>`
			}
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
			
			${renderProjectsSection(resume.projects, "modern")}
		</div>
	</div>
</body>
</html>`;
}

/**
 * Even-style template - Clean flat design inspired by jsonresume-theme-even
 */
function renderEvenTemplate(resume: JSONResume): string {
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
			font-family: 'Lato', 'Helvetica Neue', Helvetica, Arial, sans-serif;
			font-size: 14px;
			line-height: 1.5;
			color: #333;
			background: #fff;
			max-width: 800px;
			margin: 0 auto;
			padding: 30px 50px;
		}
		a { color: #2079c7; text-decoration: none; }
		a:hover { text-decoration: underline; }
		.header {
			border-bottom: 1px solid #ccc;
			padding-bottom: 20px;
			margin-bottom: 25px;
		}
		.header h1 {
			font-size: 32px;
			font-weight: 400;
			margin-bottom: 4px;
			color: #000;
		}
		.header h2 {
			font-size: 18px;
			font-weight: 300;
			color: #666;
			margin-bottom: 12px;
		}
		.contact-info {
			display: flex;
			flex-wrap: wrap;
			gap: 8px 20px;
			font-size: 13px;
			color: #666;
		}
		.contact-info span { display: flex; align-items: center; gap: 4px; }
		.section {
			margin-bottom: 25px;
		}
		.section-title {
			font-size: 16px;
			font-weight: 700;
			text-transform: uppercase;
			color: #000;
			border-bottom: 1px solid #ddd;
			padding-bottom: 6px;
			margin-bottom: 15px;
			letter-spacing: 1px;
		}
		.summary {
			color: #444;
			font-size: 14px;
			line-height: 1.7;
		}
		.item {
			margin-bottom: 18px;
		}
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			margin-bottom: 4px;
			flex-wrap: wrap;
			gap: 4px;
		}
		.item-title {
			font-weight: 700;
			font-size: 15px;
			color: #000;
		}
		.item-subtitle {
			color: #666;
			font-size: 14px;
		}
		.item-date {
			font-size: 13px;
			color: #888;
			white-space: nowrap;
		}
		.item-location {
			font-size: 13px;
			color: #888;
		}
		.highlights {
			list-style-type: disc;
			padding-left: 20px;
			margin-top: 6px;
		}
		.highlights li {
			margin-bottom: 3px;
			font-size: 13px;
			color: #444;
		}
		.skills-container {
			display: flex;
			flex-wrap: wrap;
			gap: 12px 24px;
		}
		.skill-group {
			flex: 1 1 200px;
		}
		.skill-name {
			font-weight: 600;
			color: #000;
			font-size: 14px;
		}
		.skill-keywords {
			font-size: 13px;
			color: #555;
		}
		@media print {
			body { padding: 20px; font-size: 12px; }
			.section { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>${basics.name}</h1>
		${basics.label ? `<h2>${basics.label}</h2>` : ""}
		<div class="contact-info">
			${basics.email ? `<span>✉ ${basics.email}</span>` : ""}
			${basics.phone ? `<span>☎ ${basics.phone}</span>` : ""}
			${basics.url ? `<span>🌐 <a href="${basics.url}">${basics.url}</a></span>` : ""}
			${
				basics.location?.city
					? `<span>📍 ${basics.location.city}${
							basics.location.region ? `, ${basics.location.region}` : ""
					  }</span>`
					: ""
			}
			${
				basics.profiles
					?.map(
						(p) =>
							`<span>${p.network}: <a href="${p.url}">${
								p.username || p.network
							}</a></span>`
					)
					.join("") || ""
			}
		</div>
	</div>

	${
		basics.summary
			? `
	<div class="section">
		<h3 class="section-title">Summary</h3>
		<p class="summary">${basics.summary}</p>
	</div>
	`
			: ""
	}

	${
		work && work.length > 0
			? `
	<div class="section">
		<h3 class="section-title">Experience</h3>
		${work
			.map(
				(job) => `
		<div class="item">
			<div class="item-header">
				<div>
					<span class="item-title">${job.position}</span>
					<span class="item-subtitle"> at ${job.name}</span>
				</div>
				<span class="item-date">${formatDate(job.startDate)} - ${
					job.endDate ? formatDate(job.endDate) : "Present"
				}</span>
			</div>
			${job.summary ? `<p style="color:#555;margin-top:4px;">${job.summary}</p>` : ""}
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
		<h3 class="section-title">Education</h3>
		${education
			.map(
				(edu) => `
		<div class="item">
			<div class="item-header">
				<div>
					<span class="item-title">${edu.institution}</span>
				</div>
				<span class="item-date">${
					edu.startDate ? formatDate(edu.startDate) + " - " : ""
				}${edu.endDate ? formatDate(edu.endDate) : "Present"}</span>
			</div>
			<div class="item-subtitle">${edu.studyType || "Degree"}${
					edu.area ? ` in ${edu.area}` : ""
				}</div>
		</div>
		`
			)
			.join("")}
	</div>
	`
			: ""
	}

	${renderProjectsSection(resume.projects, "standard")}

	${
		skills && skills.length > 0
			? `
	<div class="section">
		<h3 class="section-title">Skills</h3>
		<div class="skills-container">
			${skills
				.map(
					(s) => `
			<div class="skill-group">
				<span class="skill-name">${s.name}: </span>
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
</body>
</html>`;
}

/**
 * Elegant template - Professional detailed layout inspired by jsonresume-theme-elegant
 */
function renderElegantTemplate(resume: JSONResume): string {
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
			font-family: Georgia, 'Times New Roman', serif;
			font-size: 11pt;
			line-height: 1.6;
			color: #333;
			background: #fafafa;
			max-width: 900px;
			margin: 0 auto;
			padding: 40px;
		}
		.resume-container {
			background: #fff;
			border: 1px solid #e0e0e0;
			box-shadow: 0 2px 8px rgba(0,0,0,0.08);
			padding: 50px;
		}
		a { color: #1a5f7a; }
		.header {
			text-align: center;
			padding-bottom: 30px;
			border-bottom: 2px solid #1a5f7a;
			margin-bottom: 30px;
		}
		.header h1 {
			font-size: 36px;
			font-weight: 400;
			color: #1a5f7a;
			margin-bottom: 8px;
			letter-spacing: 2px;
		}
		.header h2 {
			font-size: 16px;
			font-weight: 400;
			color: #666;
			font-style: italic;
			margin-bottom: 15px;
		}
		.contact-line {
			font-size: 11px;
			color: #555;
			display: flex;
			justify-content: center;
			flex-wrap: wrap;
			gap: 6px 20px;
		}
		.section {
			margin-bottom: 30px;
		}
		.section-title {
			font-size: 14pt;
			color: #1a5f7a;
			font-weight: 400;
			border-bottom: 1px solid #ccc;
			padding-bottom: 8px;
			margin-bottom: 18px;
			text-transform: uppercase;
			letter-spacing: 3px;
		}
		.summary {
			font-size: 11pt;
			color: #444;
			line-height: 1.8;
			text-align: justify;
		}
		.item {
			margin-bottom: 22px;
			padding-left: 20px;
			border-left: 3px solid #e8e8e8;
		}
		.item:hover {
			border-left-color: #1a5f7a;
		}
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			flex-wrap: wrap;
			gap: 6px;
		}
		.item-title {
			font-size: 13pt;
			font-weight: 700;
			color: #222;
		}
		.item-subtitle {
			font-size: 11pt;
			color: #1a5f7a;
			font-style: italic;
		}
		.item-date {
			font-size: 10pt;
			color: #888;
		}
		.item-description {
			margin-top: 8px;
			font-size: 10.5pt;
			color: #555;
		}
		.highlights {
			list-style: none;
			margin-top: 10px;
			padding-left: 0;
		}
		.highlights li {
			position: relative;
			padding-left: 18px;
			margin-bottom: 5px;
			font-size: 10.5pt;
			color: #444;
		}
		.highlights li:before {
			content: "▸";
			position: absolute;
			left: 0;
			color: #1a5f7a;
		}
		.skills-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
			gap: 16px;
		}
		.skill-item {
			background: #f8f9fa;
			padding: 12px 15px;
			border-radius: 4px;
			border-left: 3px solid #1a5f7a;
		}
		.skill-name {
			font-weight: 700;
			color: #1a5f7a;
			font-size: 11pt;
			margin-bottom: 4px;
		}
		.skill-keywords {
			font-size: 10pt;
			color: #666;
		}
		@media print {
			body { padding: 0; background: #fff; }
			.resume-container { border: none; box-shadow: none; padding: 30px; }
			.section { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	<div class="resume-container">
		<div class="header">
			<h1>${basics.name}</h1>
			${basics.label ? `<h2>${basics.label}</h2>` : ""}
			<div class="contact-line">
				${basics.email ? `<span>${basics.email}</span>` : ""}
				${basics.phone ? `<span>${basics.phone}</span>` : ""}
				${basics.url ? `<span><a href="${basics.url}">${basics.url}</a></span>` : ""}
				${
					basics.location?.city
						? `<span>${basics.location.city}${
								basics.location.region ? `, ${basics.location.region}` : ""
						  }</span>`
						: ""
				}
				${
					basics.profiles
						?.map((p) => `<span><a href="${p.url}">${p.network}</a></span>`)
						.join("") || ""
				}
			</div>
		</div>

		${
			basics.summary
				? `
		<div class="section">
			<h3 class="section-title">Profile</h3>
			<p class="summary">${basics.summary}</p>
		</div>
		`
				: ""
		}

		${
			work && work.length > 0
				? `
		<div class="section">
			<h3 class="section-title">Professional Experience</h3>
			${work
				.map(
					(job) => `
			<div class="item">
				<div class="item-header">
					<span class="item-title">${job.position}</span>
					<span class="item-date">${formatDate(job.startDate)} – ${
						job.endDate ? formatDate(job.endDate) : "Present"
					}</span>
				</div>
				<div class="item-subtitle">${job.name}</div>
				${job.summary ? `<p class="item-description">${job.summary}</p>` : ""}
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
			<h3 class="section-title">Education</h3>
			${education
				.map(
					(edu) => `
			<div class="item">
				<div class="item-header">
					<span class="item-title">${edu.institution}</span>
					<span class="item-date">${edu.endDate ? formatDate(edu.endDate) : ""}</span>
				</div>
				<div class="item-subtitle">${edu.studyType || "Degree"}${
						edu.area ? ` in ${edu.area}` : ""
					}</div>
			</div>
			`
				)
				.join("")}
		</div>
		`
				: ""
		}

		${
			skills && skills.length > 0
				? `
		<div class="section">
			<h3 class="section-title">Skills & Expertise</h3>
			<div class="skills-grid">
				${skills
					.map(
						(s) => `
				<div class="skill-item">
					<div class="skill-name">${s.name}</div>
					<div class="skill-keywords">${s.keywords?.join(", ") || ""}</div>
				</div>
				`
					)
					.join("")}
			</div>
		</div>
		`
				: ""
		}
	</div>
</body>
</html>`;
}

/**
 * Standard template - The official reference theme, clean and professional
 */
function renderStandardTemplate(resume: JSONResume): string {
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
			font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
			font-size: 13px;
			line-height: 1.5;
			color: #333;
			background: #fff;
			max-width: 750px;
			margin: 0 auto;
			padding: 40px 30px;
		}
		a { color: #0066cc; text-decoration: none; }
		a:hover { text-decoration: underline; }
		.header {
			margin-bottom: 24px;
			padding-bottom: 16px;
			border-bottom: 2px solid #333;
		}
		.header h1 {
			font-size: 28px;
			font-weight: 700;
			color: #000;
			margin-bottom: 4px;
		}
		.header h2 {
			font-size: 16px;
			font-weight: 400;
			color: #555;
			margin-bottom: 10px;
		}
		.contact {
			font-size: 12px;
			color: #666;
		}
		.contact span { margin-right: 12px; }
		.section {
			margin-bottom: 20px;
		}
		.section-title {
			font-size: 14px;
			font-weight: 700;
			text-transform: uppercase;
			color: #000;
			border-bottom: 1px solid #ccc;
			padding-bottom: 4px;
			margin-bottom: 12px;
			letter-spacing: 0.5px;
		}
		.summary {
			font-size: 13px;
			line-height: 1.6;
			color: #444;
		}
		.item {
			margin-bottom: 14px;
		}
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			margin-bottom: 2px;
		}
		.item-title {
			font-weight: 700;
			font-size: 14px;
			color: #000;
		}
		.item-subtitle {
			font-size: 13px;
			color: #555;
			font-style: italic;
		}
		.item-date {
			font-size: 12px;
			color: #777;
		}
		.highlights {
			list-style-type: disc;
			padding-left: 18px;
			margin-top: 4px;
		}
		.highlights li {
			margin-bottom: 2px;
			font-size: 12px;
			color: #444;
		}
		.skills-list {
			display: flex;
			flex-wrap: wrap;
			gap: 6px 16px;
		}
		.skill-group {
			font-size: 12px;
		}
		.skill-name { font-weight: 600; }
		.skill-keywords { color: #555; }
		@media print {
			body { padding: 20px; font-size: 11px; }
			.section { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>${basics.name}</h1>
		${basics.label ? `<h2>${basics.label}</h2>` : ""}
		<div class="contact">
			${basics.email ? `<span>${basics.email}</span>` : ""}
			${basics.phone ? `<span>${basics.phone}</span>` : ""}
			${basics.url ? `<span><a href="${basics.url}">${basics.url}</a></span>` : ""}
			${
				basics.location?.city
					? `<span>${basics.location.city}${
							basics.location.region ? `, ${basics.location.region}` : ""
					  }</span>`
					: ""
			}
		</div>
	</div>

	${
		basics.summary
			? `
	<div class="section">
		<h3 class="section-title">Summary</h3>
		<p class="summary">${basics.summary}</p>
	</div>
	`
			: ""
	}

	${
		work && work.length > 0
			? `
	<div class="section">
		<h3 class="section-title">Experience</h3>
		${work
			.map(
				(job) => `
		<div class="item">
			<div class="item-header">
				<span class="item-title">${job.position}</span>
				<span class="item-date">${formatDate(job.startDate)} - ${
					job.endDate ? formatDate(job.endDate) : "Present"
				}</span>
			</div>
			<div class="item-subtitle">${job.name}</div>
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
		<h3 class="section-title">Education</h3>
		${education
			.map(
				(edu) => `
		<div class="item">
			<div class="item-header">
				<span class="item-title">${edu.institution}</span>
				<span class="item-date">${edu.endDate ? formatDate(edu.endDate) : ""}</span>
			</div>
			<div class="item-subtitle">${edu.studyType || "Degree"}${
					edu.area ? ` in ${edu.area}` : ""
				}</div>
		</div>
		`
			)
			.join("")}
	</div>
	`
			: ""
	}

	${
		skills && skills.length > 0
			? `
	<div class="section">
		<h3 class="section-title">Skills</h3>
		<div class="skills-list">
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
</body>
</html>`;
}

/**
 * Professional template - Modern executive design with great typography
 */
function renderProfessionalTemplate(resume: JSONResume): string {
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
			font-family: 'Cambria', Georgia, serif;
			font-size: 11pt;
			line-height: 1.5;
			color: #2c3e50;
			background: #fff;
			max-width: 850px;
			margin: 0 auto;
			padding: 50px 60px;
		}
		a { color: #2980b9; text-decoration: none; }
		.header {
			text-align: center;
			margin-bottom: 30px;
		}
		.header h1 {
			font-size: 32px;
			font-weight: 400;
			color: #1a252f;
			letter-spacing: 3px;
			text-transform: uppercase;
			margin-bottom: 8px;
		}
		.header h2 {
			font-size: 14px;
			font-weight: 400;
			color: #7f8c8d;
			letter-spacing: 2px;
			text-transform: uppercase;
			margin-bottom: 12px;
		}
		.contact {
			font-size: 11px;
			color: #555;
			display: flex;
			justify-content: center;
			flex-wrap: wrap;
			gap: 4px 20px;
		}
		.divider {
			height: 3px;
			background: linear-gradient(90deg, transparent, #2c3e50, transparent);
			margin: 20px 0;
		}
		.section {
			margin-bottom: 24px;
		}
		.section-title {
			font-size: 12pt;
			font-weight: 700;
			text-transform: uppercase;
			color: #2c3e50;
			letter-spacing: 2px;
			margin-bottom: 14px;
			padding-bottom: 6px;
			border-bottom: 1px solid #bdc3c7;
		}
		.summary {
			font-size: 11pt;
			line-height: 1.7;
			color: #34495e;
			text-align: justify;
		}
		.item {
			margin-bottom: 18px;
		}
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			margin-bottom: 4px;
		}
		.item-title {
			font-weight: 700;
			font-size: 12pt;
			color: #1a252f;
		}
		.item-company {
			font-size: 11pt;
			color: #2980b9;
			font-style: italic;
		}
		.item-date {
			font-size: 10pt;
			color: #7f8c8d;
			font-style: italic;
		}
		.highlights {
			list-style: none;
			padding-left: 0;
			margin-top: 6px;
		}
		.highlights li {
			position: relative;
			padding-left: 16px;
			margin-bottom: 4px;
			font-size: 10.5pt;
			color: #34495e;
		}
		.highlights li:before {
			content: "•";
			position: absolute;
			left: 0;
			color: #2980b9;
		}
		.skills-container {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 12px 30px;
		}
		.skill-item {
			font-size: 10.5pt;
		}
		.skill-name {
			font-weight: 700;
			color: #2c3e50;
		}
		.skill-keywords {
			color: #555;
		}
		@media print {
			body { padding: 30px; }
			.section { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>${basics.name}</h1>
		${basics.label ? `<h2>${basics.label}</h2>` : ""}
		<div class="contact">
			${basics.email ? `<span>${basics.email}</span>` : ""}
			${basics.phone ? `<span>${basics.phone}</span>` : ""}
			${basics.url ? `<span><a href="${basics.url}">${basics.url}</a></span>` : ""}
			${
				basics.location?.city
					? `<span>${basics.location.city}${
							basics.location.region ? `, ${basics.location.region}` : ""
					  }</span>`
					: ""
			}
		</div>
	</div>
	<div class="divider"></div>

	${
		basics.summary
			? `
	<div class="section">
		<h3 class="section-title">Professional Profile</h3>
		<p class="summary">${basics.summary}</p>
	</div>
	`
			: ""
	}

	${
		work && work.length > 0
			? `
	<div class="section">
		<h3 class="section-title">Professional Experience</h3>
		${work
			.map(
				(job) => `
		<div class="item">
			<div class="item-header">
				<div>
					<span class="item-title">${job.position}</span>
					<span class="item-company"> — ${job.name}</span>
				</div>
				<span class="item-date">${formatDate(job.startDate)} – ${
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
		<h3 class="section-title">Education</h3>
		${education
			.map(
				(edu) => `
		<div class="item">
			<div class="item-header">
				<div>
					<span class="item-title">${edu.institution}</span>
				</div>
				<span class="item-date">${edu.endDate ? formatDate(edu.endDate) : ""}</span>
			</div>
			<div style="font-size:10.5pt;color:#34495e;">${edu.studyType || "Degree"}${
					edu.area ? ` in ${edu.area}` : ""
				}</div>
		</div>
		`
			)
			.join("")}
	</div>
	`
			: ""
	}

	${
		skills && skills.length > 0
			? `
	<div class="section">
		<h3 class="section-title">Core Competencies</h3>
		<div class="skills-container">
			${skills
				.map(
					(s) => `
			<div class="skill-item">
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
</body>
</html>`;
}

/**
 * Flat template - Contemporary flat design with clean lines
 */
function renderFlatTemplate(resume: JSONResume): string {
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
			font-family: 'Roboto', 'Segoe UI', sans-serif;
			font-size: 14px;
			line-height: 1.6;
			color: #212121;
			background: #fafafa;
			padding: 0;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
			background: #fff;
			box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		}
		a { color: #1976d2; text-decoration: none; }
		.header {
			background: #37474f;
			color: #fff;
			padding: 40px 50px;
		}
		.header h1 {
			font-size: 36px;
			font-weight: 300;
			margin-bottom: 6px;
		}
		.header h2 {
			font-size: 16px;
			font-weight: 300;
			opacity: 0.9;
			margin-bottom: 16px;
		}
		.contact {
			display: flex;
			flex-wrap: wrap;
			gap: 6px 20px;
			font-size: 13px;
			opacity: 0.85;
		}
		.contact a { color: #90caf9; }
		.main {
			padding: 40px 50px;
		}
		.section {
			margin-bottom: 28px;
		}
		.section-title {
			font-size: 13px;
			font-weight: 500;
			text-transform: uppercase;
			color: #1976d2;
			letter-spacing: 1.5px;
			margin-bottom: 16px;
			padding-bottom: 8px;
			border-bottom: 2px solid #e0e0e0;
		}
		.summary {
			font-size: 14px;
			line-height: 1.7;
			color: #424242;
		}
		.item {
			margin-bottom: 20px;
			padding-left: 16px;
			border-left: 3px solid #e0e0e0;
		}
		.item:hover { border-left-color: #1976d2; }
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
			margin-bottom: 4px;
		}
		.item-title {
			font-weight: 500;
			font-size: 15px;
			color: #212121;
		}
		.item-subtitle {
			font-size: 14px;
			color: #616161;
		}
		.item-date {
			font-size: 12px;
			color: #9e9e9e;
			background: #f5f5f5;
			padding: 2px 8px;
			border-radius: 3px;
		}
		.highlights {
			list-style: none;
			margin-top: 8px;
		}
		.highlights li {
			position: relative;
			padding-left: 14px;
			margin-bottom: 4px;
			font-size: 13px;
			color: #424242;
		}
		.highlights li:before {
			content: "→";
			position: absolute;
			left: 0;
			color: #1976d2;
			font-size: 11px;
		}
		.skills-grid {
			display: flex;
			flex-wrap: wrap;
			gap: 10px;
		}
		.skill-tag {
			background: #e3f2fd;
			color: #1976d2;
			padding: 6px 14px;
			border-radius: 20px;
			font-size: 12px;
			font-weight: 500;
		}
		@media print {
			body { background: #fff; }
			.container { box-shadow: none; }
			.header { background: #37474f !important; -webkit-print-color-adjust: exact; }
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>${basics.name}</h1>
			${basics.label ? `<h2>${basics.label}</h2>` : ""}
			<div class="contact">
				${basics.email ? `<span>✉ ${basics.email}</span>` : ""}
				${basics.phone ? `<span>☎ ${basics.phone}</span>` : ""}
				${basics.url ? `<span><a href="${basics.url}">🌐 Website</a></span>` : ""}
				${basics.location?.city ? `<span>📍 ${basics.location.city}</span>` : ""}
			</div>
		</div>
		<div class="main">
			${
				basics.summary
					? `
			<div class="section">
				<h3 class="section-title">About</h3>
				<p class="summary">${basics.summary}</p>
			</div>
			`
					: ""
			}

			${
				work && work.length > 0
					? `
			<div class="section">
				<h3 class="section-title">Experience</h3>
				${work
					.map(
						(job) => `
				<div class="item">
					<div class="item-header">
						<div>
							<span class="item-title">${job.position}</span>
							<span class="item-subtitle"> at ${job.name}</span>
						</div>
						<span class="item-date">${formatDate(job.startDate)} - ${
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
				<h3 class="section-title">Education</h3>
				${education
					.map(
						(edu) => `
				<div class="item">
					<div class="item-header">
						<span class="item-title">${edu.institution}</span>
						<span class="item-date">${edu.endDate ? formatDate(edu.endDate) : ""}</span>
					</div>
					<div class="item-subtitle">${edu.studyType || "Degree"}${
							edu.area ? ` in ${edu.area}` : ""
						}</div>
				</div>
				`
					)
					.join("")}
			</div>
			`
					: ""
			}

			${
				skills && skills.length > 0
					? `
			<div class="section">
				<h3 class="section-title">Skills</h3>
				<div class="skills-grid">
					${skills
						.flatMap((s) => s.keywords || [])
						.map((k) => `<span class="skill-tag">${k}</span>`)
						.join("")}
				</div>
			</div>
			`
					: ""
			}
		</div>
	</div>
</body>
</html>`;
}

/**
 * Spartacus template - Bold and impactful with strong visual hierarchy
 */
function renderSpartacusTemplate(resume: JSONResume): string {
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
			font-family: 'Montserrat', 'Helvetica Neue', sans-serif;
			font-size: 13px;
			line-height: 1.5;
			color: #222;
			background: #fff;
		}
		.container {
			max-width: 850px;
			margin: 0 auto;
		}
		a { color: #c0392b; text-decoration: none; }
		.header {
			background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
			color: #fff;
			padding: 50px;
			text-align: center;
		}
		.header h1 {
			font-size: 42px;
			font-weight: 700;
			letter-spacing: 4px;
			text-transform: uppercase;
			margin-bottom: 8px;
		}
		.header h2 {
			font-size: 16px;
			font-weight: 300;
			letter-spacing: 6px;
			text-transform: uppercase;
			opacity: 0.8;
			margin-bottom: 20px;
		}
		.contact {
			display: flex;
			justify-content: center;
			flex-wrap: wrap;
			gap: 8px 24px;
			font-size: 12px;
			opacity: 0.9;
		}
		.contact a { color: #e74c3c; }
		.main {
			padding: 40px 50px;
		}
		.section {
			margin-bottom: 32px;
		}
		.section-title {
			font-size: 18px;
			font-weight: 700;
			text-transform: uppercase;
			color: #1a1a2e;
			letter-spacing: 3px;
			margin-bottom: 18px;
			padding-bottom: 10px;
			border-bottom: 3px solid #e74c3c;
			display: inline-block;
		}
		.summary {
			font-size: 14px;
			line-height: 1.8;
			color: #444;
			border-left: 4px solid #e74c3c;
			padding-left: 20px;
		}
		.item {
			margin-bottom: 24px;
		}
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 8px;
		}
		.item-title {
			font-weight: 700;
			font-size: 16px;
			color: #1a1a2e;
			text-transform: uppercase;
			letter-spacing: 1px;
		}
		.item-company {
			font-size: 14px;
			color: #e74c3c;
			font-weight: 600;
		}
		.item-date {
			font-size: 12px;
			color: #888;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 1px;
		}
		.highlights {
			list-style: none;
			margin-top: 10px;
			padding-left: 0;
		}
		.highlights li {
			position: relative;
			padding-left: 20px;
			margin-bottom: 6px;
			font-size: 13px;
			color: #444;
		}
		.highlights li:before {
			content: "▸";
			position: absolute;
			left: 0;
			color: #e74c3c;
			font-weight: bold;
		}
		.skills-container {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
		}
		.skill-box {
			background: #1a1a2e;
			color: #fff;
			padding: 10px 20px;
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 1px;
		}
		@media print {
			.header { background: #1a1a2e !important; -webkit-print-color-adjust: exact; }
			.section { page-break-inside: avoid; }
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>${basics.name}</h1>
			${basics.label ? `<h2>${basics.label}</h2>` : ""}
			<div class="contact">
				${basics.email ? `<span>${basics.email}</span>` : ""}
				${basics.phone ? `<span>${basics.phone}</span>` : ""}
				${basics.url ? `<span><a href="${basics.url}">${basics.url}</a></span>` : ""}
				${
					basics.location?.city
						? `<span>${basics.location.city}${
								basics.location.region ? `, ${basics.location.region}` : ""
						  }</span>`
						: ""
				}
			</div>
		</div>
		<div class="main">
			${
				basics.summary
					? `
			<div class="section">
				<h3 class="section-title">Profile</h3>
				<p class="summary">${basics.summary}</p>
			</div>
			`
					: ""
			}

			${
				work && work.length > 0
					? `
			<div class="section">
				<h3 class="section-title">Experience</h3>
				${work
					.map(
						(job) => `
				<div class="item">
					<div class="item-header">
						<div>
							<div class="item-title">${job.position}</div>
							<div class="item-company">${job.name}</div>
						</div>
						<span class="item-date">${formatDate(job.startDate)} — ${
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
				<h3 class="section-title">Education</h3>
				${education
					.map(
						(edu) => `
				<div class="item">
					<div class="item-header">
						<div>
							<div class="item-title">${edu.institution}</div>
							<div class="item-company">${edu.studyType || "Degree"}${
							edu.area ? ` in ${edu.area}` : ""
						}</div>
						</div>
						<span class="item-date">${edu.endDate ? formatDate(edu.endDate) : ""}</span>
					</div>
				</div>
				`
					)
					.join("")}
			</div>
			`
					: ""
			}

			${
				skills && skills.length > 0
					? `
			<div class="section">
				<h3 class="section-title">Expertise</h3>
				<div class="skills-container">
					${skills.map((s) => `<div class="skill-box">${s.name}</div>`).join("")}
				</div>
			</div>
			`
					: ""
			}
		</div>
	</div>
</body>
</html>`;
}

/**
 * Paper template - Minimal paper-like design focused on content
 */
function renderPaperTemplate(resume: JSONResume): string {
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
			font-family: 'Linux Libertine', 'Times New Roman', serif;
			font-size: 11pt;
			line-height: 1.4;
			color: #111;
			background: #f5f5f5;
			padding: 20px;
		}
		.page {
			max-width: 8.5in;
			min-height: 11in;
			margin: 0 auto;
			background: #fff;
			padding: 0.75in 1in;
			box-shadow: 0 0 10px rgba(0,0,0,0.1);
		}
		a { color: #111; }
		.header {
			text-align: center;
			margin-bottom: 20px;
			padding-bottom: 12px;
			border-bottom: 0.5pt solid #111;
		}
		.header h1 {
			font-size: 20pt;
			font-weight: normal;
			font-variant: small-caps;
			letter-spacing: 2px;
			margin-bottom: 4px;
		}
		.contact {
			font-size: 10pt;
			color: #333;
		}
		.contact span { margin: 0 8px; }
		.contact span:not(:last-child):after { content: "•"; margin-left: 16px; }
		.section {
			margin-bottom: 16px;
		}
		.section-title {
			font-size: 11pt;
			font-weight: bold;
			font-variant: small-caps;
			letter-spacing: 1px;
			margin-bottom: 8px;
			padding-bottom: 2px;
			border-bottom: 0.5pt solid #999;
		}
		.summary {
			font-size: 10.5pt;
			text-align: justify;
			hyphens: auto;
		}
		.item {
			margin-bottom: 10px;
		}
		.item-header {
			display: flex;
			justify-content: space-between;
			align-items: baseline;
		}
		.item-title {
			font-weight: bold;
			font-size: 10.5pt;
		}
		.item-subtitle {
			font-style: italic;
			font-size: 10.5pt;
		}
		.item-date {
			font-size: 10pt;
			color: #555;
		}
		.highlights {
			list-style-type: disc;
			padding-left: 18px;
			margin-top: 4px;
		}
		.highlights li {
			font-size: 10pt;
			margin-bottom: 1px;
			text-align: justify;
		}
		.skills-line {
			font-size: 10pt;
		}
		.skills-line strong {
			font-variant: small-caps;
		}
		@media print {
			body { background: #fff; padding: 0; }
			.page { box-shadow: none; padding: 0.5in 0.75in; }
		}
	</style>
</head>
<body>
	<div class="page">
		<div class="header">
			<h1>${basics.name}</h1>
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
				${basics.url ? `<span><a href="${basics.url}">${basics.url}</a></span>` : ""}
			</div>
		</div>

		${
			basics.summary
				? `
		<div class="section">
			<h3 class="section-title">Summary</h3>
			<p class="summary">${basics.summary}</p>
		</div>
		`
				: ""
		}

		${
			work && work.length > 0
				? `
		<div class="section">
			<h3 class="section-title">Experience</h3>
			${work
				.map(
					(job) => `
			<div class="item">
				<div class="item-header">
					<div>
						<span class="item-title">${job.name}</span>
						<span class="item-subtitle"> — ${job.position}</span>
					</div>
					<span class="item-date">${formatDate(job.startDate)}–${
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
			<h3 class="section-title">Education</h3>
			${education
				.map(
					(edu) => `
			<div class="item">
				<div class="item-header">
					<div>
						<span class="item-title">${edu.institution}</span>
						<span class="item-subtitle"> — ${edu.studyType || ""}${
						edu.area ? ` in ${edu.area}` : ""
					}</span>
					</div>
					<span class="item-date">${edu.endDate ? formatDate(edu.endDate) : ""}</span>
				</div>
			</div>
			`
				)
				.join("")}
		</div>
		`
				: ""
		}

		${
			skills && skills.length > 0
				? `
		<div class="section">
			<h3 class="section-title">Skills</h3>
			${skills
				.map(
					(s) => `
			<p class="skills-line"><strong>${s.name}:</strong> ${
						s.keywords?.join(", ") || ""
					}</p>
			`
				)
				.join("")}
		</div>
		`
				: ""
		}
	</div>
</body>
</html>`;
}
