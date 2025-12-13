"use client";

import { slugify } from "@/lib/utils";

export type KeywordSet = {
	skills: string[];
	tools: string[];
	responsibilities: string[];
	domains: string[];
};

export type ExtraField = { key: string; value: string };

export type RecruiterDetails = {
	name?: string;
	email?: string;
	phone?: string;
	linkedin?: string;
	notes?: string;
};

export type TemplateOption = {
	id: string;
	name: string;
	locale: string;
	style: string;
	preview: string;
	emphasis: string[];
};

export type DocumentVersion = {
	id: string;
	jobId: string;
	companyId: string;
	type: "resume" | "cover_letter";
	version: number;
	title: string;
	templateId: string;
	templateName: string;
	createdAt: string;
	keywords: KeywordSet;
	paths: {
		pdf: string;
		docx: string;
	};
	note?: string;
};

export type JobApplication = {
	id: string;
	title: string;
	description: string;
	link?: string;
	employmentType?: string;
	workMode?: "Remote" | "Hybrid" | "On-site" | string;
	recruiter: RecruiterDetails;
	extraFields: ExtraField[];
	keywords: KeywordSet;
	selectedTemplateId: string;
	resumeDraft: string;
	coverLetterDraft: string;
	versions: DocumentVersion[];
	notes?: string;
};

export type AuditLogEntry = {
	id: string;
	action: string;
	timestamp: string;
	actor: string;
};

export type CompanyFolder = {
	id: string;
	slug: string;
	name: string;
	website?: string;
	industry?: string;
	status:
		| "saved"
		| "applied"
		| "interviewing"
		| "offered"
		| "rejected"
		| "withdrawn";
	createdAt: string;
	lastActivity: string;
	jobs: JobApplication[];
	auditLog: AuditLogEntry[];
	notes?: string;
};

export const keywordLibrary: KeywordSet = {
	skills: [
		"react",
		"typescript",
		"python",
		"product",
		"roadmap",
		"graphql",
		"data",
		"design system",
		"accessibility",
		"mentoring",
	],
	tools: [
		"next.js",
		"tailwind",
		"supabase",
		"prisma",
		"aws",
		"figma",
		"vitest",
		"playwright",
		"postgres",
		"airflow",
	],
	responsibilities: [
		"lead",
		"own",
		"ship",
		"scale",
		"optimize",
		"collaborate",
		"partner",
		"drive adoption",
		"interview",
		"coach",
	],
	domains: [
		"saas",
		"b2b",
		"ai",
		"ml",
		"analytics",
		"fintech",
		"marketplace",
		"mobile",
		"devtools",
		"platform",
	],
};

export const templateOptions: TemplateOption[] = [
	{
		id: "json-compact",
		name: "Compact JSON",
		locale: "US",
		style: "Single column, ATS-first",
		preview: "Summary and skills up top, clean bullet stack.",
		emphasis: ["Keyword dense summary", "Tight spacing for 1 page"],
	},
	{
		id: "json-eu",
		name: "EU Photo",
		locale: "DE/EU",
		style: "Two column with optional photo slot",
		preview: "Left rail for skills/links, right for experience.",
		emphasis: ["Photo ready", "Bilingual labels optional"],
	},
	{
		id: "json-product",
		name: "Product Story",
		locale: "Global",
		style: "Case study heavy",
		preview: "Pairs impact bullets with metrics callouts.",
		emphasis: ["Quantified wins", "Project spotlight per role"],
	},
];

const atlasFrontendKeywords: KeywordSet = {
	skills: ["React", "TypeScript", "Accessibility", "Design system"],
	tools: ["Next.js", "Tailwind", "Vitest", "Playwright", "GraphQL"],
	responsibilities: [
		"Lead UI architecture",
		"Ship accessible web apps",
		"Mentor engineers",
		"Partner with backend",
	],
	domains: ["B2B", "SaaS", "Analytics"],
};

const atlasProductKeywords: KeywordSet = {
	skills: ["Product", "Roadmap", "Stakeholder management", "Experimentation"],
	tools: ["Figma", "SQL", "Amplitude", "Jira"],
	responsibilities: [
		"Define roadmap",
		"Run discovery",
		"Prioritize backlog",
		"Partner with engineering",
	],
	domains: ["AI", "Platform", "SaaS"],
};

const northwindDataKeywords: KeywordSet = {
	skills: ["Python", "Data engineering", "Observability", "Stakeholder management"],
	tools: ["Airflow", "dbt", "AWS", "Postgres"],
	responsibilities: [
		"Harden pipelines",
		"Improve SLAs",
		"Coach analysts",
		"Scale ingestion",
	],
	domains: ["Mobility", "IoT", "Analytics"],
};

export const companyDirectory: CompanyFolder[] = [
	{
		id: "atlas-labs",
		slug: "atlas-labs",
		name: "Atlas Labs",
		industry: "AI analytics",
		website: "https://atlaslabs.ai",
		status: "interviewing",
		createdAt: "2025-10-02",
		lastActivity: "2025-12-10",
		jobs: [
			{
				id: "atlas-frontend",
				title: "Senior Frontend Engineer",
				description:
					"Lead the React and TypeScript frontend for our analytics suite. Build accessible UI components in Next.js and Tailwind, partner with backend on GraphQL integration, and keep Lighthouse scores above 95. Requirements: 5+ years building design systems, strong testing discipline with Playwright/Vitest, and experience shipping B2B SaaS.",
				link: "https://atlaslabs.ai/careers/frontend",
				employmentType: "Full-time",
				workMode: "Hybrid",
				recruiter: {
					name: "Chloe Kim",
					email: "chloe.kim@atlaslabs.ai",
					phone: "+1 555-0123",
					linkedin: "https://linkedin.com/in/chloekim",
					notes: "Prefers async updates before onsite loop.",
				},
				extraFields: [
					{ key: "Referral", value: "Internal PM referral" },
					{ key: "Notice period", value: "2 weeks" },
				],
				keywords: atlasFrontendKeywords,
				selectedTemplateId: "json-compact",
				resumeDraft:
					"Lean ATS resume focused on React/TypeScript, accessibility, and design systems. Highlights Playwright/Vitest testing and GraphQL integration for analytics dashboards.",
				coverLetterDraft:
					"Introduces experience leading UI platforms, highlights accessibility wins, and references Atlas Labs analytics customers.",
				versions: [
					{
						id: "atlas-frontend-resume-v2",
						jobId: "atlas-frontend",
						companyId: "atlas-labs",
						type: "resume",
						version: 2,
						title: "Senior Frontend Engineer - Resume v2",
						templateId: "json-compact",
						templateName: "Compact JSON",
						createdAt: "2025-12-10",
						keywords: atlasFrontendKeywords,
						paths: {
							pdf: "companies/atlas-labs/frontend-engineer/resume-v2.pdf",
							docx: "companies/atlas-labs/frontend-engineer/resume-v2.docx",
						},
						note: "Includes ATS keyword highlights and quantified accessibility uplift.",
					},
					{
						id: "atlas-frontend-cover-v1",
						jobId: "atlas-frontend",
						companyId: "atlas-labs",
						type: "cover_letter",
						version: 1,
						title: "Senior Frontend Engineer - Cover Letter",
						templateId: "json-compact",
						templateName: "Compact JSON",
						createdAt: "2025-12-09",
						keywords: atlasFrontendKeywords,
						paths: {
							pdf: "companies/atlas-labs/frontend-engineer/cover-letter-v1.pdf",
							docx: "companies/atlas-labs/frontend-engineer/cover-letter-v1.docx",
						},
						note: "References design system rollout and customer NPS lift.",
					},
				],
				notes: "Applied with v1, v2 tuned for onsite panel.",
			},
			{
				id: "atlas-product",
				title: "Product Manager, AI Platform",
				description:
					"Own the roadmap for Atlas Labs' model monitoring platform. Run discovery with enterprise customers, prioritize safeguards for drift and hallucination detection, and coordinate with GTM for rollout. Looking for PMs who can partner with engineers on data quality, run experiments, and communicate clearly with legal/compliance.",
				link: "https://atlaslabs.ai/careers/product-platform",
				employmentType: "Full-time",
				workMode: "Remote",
				recruiter: {
					name: "Marcus Teo",
					email: "marcus.teo@atlaslabs.ai",
				},
				extraFields: [
					{ key: "Expected salary", value: "$180k base + equity" },
					{ key: "Work authorization", value: "US Citizen" },
				],
				keywords: atlasProductKeywords,
				selectedTemplateId: "json-product",
				resumeDraft:
					"Product resume leaning on AI platform launches, customer discovery, and experiment design with quantified adoption metrics.",
				coverLetterDraft:
					"References model monitoring pilots, compliance alignment, and GTM rollout with customer stories.",
				versions: [
					{
						id: "atlas-product-resume-v1",
						jobId: "atlas-product",
						companyId: "atlas-labs",
						type: "resume",
						version: 1,
						title: "PM AI Platform - Resume v1",
						templateId: "json-product",
						templateName: "Product Story",
						createdAt: "2025-11-28",
						keywords: atlasProductKeywords,
						paths: {
							pdf: "companies/atlas-labs/product-manager/resume-v1.pdf",
							docx: "companies/atlas-labs/product-manager/resume-v1.docx",
						},
						note: "First pass focused on discovery and adoption metrics.",
					},
					{
						id: "atlas-product-cover-v1",
						jobId: "atlas-product",
						companyId: "atlas-labs",
						type: "cover_letter",
						version: 1,
						title: "PM AI Platform - Cover Letter",
						templateId: "json-product",
						templateName: "Product Story",
						createdAt: "2025-11-28",
						keywords: atlasProductKeywords,
						paths: {
							pdf: "companies/atlas-labs/product-manager/cover-letter-v1.pdf",
							docx: "companies/atlas-labs/product-manager/cover-letter-v1.docx",
						},
					},
				],
			},
		],
		auditLog: [
			{
				id: "atlas-log-1",
				action: "Generated resume v2 with updated accessibility metrics",
				timestamp: "2025-12-10T09:24:00Z",
				actor: "You",
			},
			{
				id: "atlas-log-2",
				action: "Saved recruiter notes for Chloe Kim",
				timestamp: "2025-12-08T16:10:00Z",
				actor: "You",
			},
		],
	},
	{
		id: "northwind-mobility",
		slug: "northwind-mobility",
		name: "Northwind Mobility",
		industry: "Mobility",
		website: "https://northwindmobility.com",
		status: "applied",
		createdAt: "2025-09-12",
		lastActivity: "2025-12-05",
		jobs: [
			{
				id: "northwind-data",
				title: "Senior Data Engineer",
				description:
					"Harden Northwind's mobility data pipelines. Migrate legacy jobs into Airflow and dbt, improve SLAs for telemetry ingestion, and tighten observability. Looking for experience with AWS, columnar storage, and partnering with product analysts on downstream models.",
				link: "https://northwindmobility.com/careers/data-engineer",
				employmentType: "Full-time",
				workMode: "On-site",
				recruiter: {
					name: "Priya Singh",
					email: "priya.singh@northwindmobility.com",
					notes: "Asked for latest DOCX export and pipeline reliability highlights.",
				},
				extraFields: [
					{ key: "Notice period", value: "3 weeks" },
					{ key: "Target location", value: "Austin HQ" },
				],
				keywords: northwindDataKeywords,
				selectedTemplateId: "json-compact",
				resumeDraft:
					"Resume centered on data reliability, Airflow/dbt migration, and SLA improvements with AWS stack.",
				coverLetterDraft:
					"Cover letter ties pipeline hardening work to Northwind's telemetry reliability goals.",
				versions: [
					{
						id: "northwind-data-resume-v1",
						jobId: "northwind-data",
						companyId: "northwind-mobility",
						type: "resume",
						version: 1,
						title: "Senior Data Engineer - Resume v1",
						templateId: "json-compact",
						templateName: "Compact JSON",
						createdAt: "2025-12-03",
						keywords: northwindDataKeywords,
						paths: {
							pdf: "companies/northwind-mobility/data-engineer/resume-v1.pdf",
							docx: "companies/northwind-mobility/data-engineer/resume-v1.docx",
						},
					},
					{
						id: "northwind-data-cover-v1",
						jobId: "northwind-data",
						companyId: "northwind-mobility",
						type: "cover_letter",
						version: 1,
						title: "Senior Data Engineer - Cover Letter",
						templateId: "json-compact",
						templateName: "Compact JSON",
						createdAt: "2025-12-03",
						keywords: northwindDataKeywords,
						paths: {
							pdf: "companies/northwind-mobility/data-engineer/cover-letter-v1.pdf",
							docx: "companies/northwind-mobility/data-engineer/cover-letter-v1.docx",
						},
					},
				],
			},
		],
		auditLog: [
			{
				id: "northwind-log-1",
				action: "Marked application as Applied and generated follow-up reminder",
				timestamp: "2025-12-05T13:00:00Z",
				actor: "You",
			},
		],
	},
];

export function slugFromName(name: string) {
	return slugify(name);
}

export function findCompanyBySlug(slug: string) {
	return companyDirectory.find(
		(company) => company.slug.toLowerCase() === slug.toLowerCase()
	);
}

export function companyExistsByName(name: string) {
	return companyDirectory.some(
		(company) => company.name.toLowerCase() === name.toLowerCase()
	);
}

