/**
 * Sample JSONResume data for template previews
 * This uses fake data so users can see template styles before AI generation
 */

export type ResumeSection =
	| "summary"
	| "skills"
	| "experience"
	| "education"
	| "projects";

export interface JSONResume {
	basics: {
		name: string;
		label: string;
		image?: string;
		email: string;
		phone: string;
		url?: string;
		summary: string;
		location: {
			address?: string;
			postalCode?: string;
			city: string;
			countryCode: string;
			region?: string;
		};
		profiles: {
			network: string;
			username: string;
			url: string;
		}[];
	};
	work: {
		name: string;
		position: string;
		url?: string;
		startDate: string;
		endDate?: string;
		summary?: string;
		highlights: string[];
	}[];
	education: {
		institution: string;
		url?: string;
		area: string;
		studyType: string;
		startDate: string;
		endDate?: string;
		score?: string;
		courses?: string[];
	}[];
	skills: {
		name: string;
		level?: string;
		keywords: string[];
	}[];
	languages?: {
		language: string;
		fluency: string;
	}[];
	projects?: {
		name: string;
		description: string;
		highlights: string[];
		keywords: string[];
		startDate?: string;
		endDate?: string;
		url?: string;
	}[];
	certificates?: {
		name: string;
		date: string;
		issuer: string;
		url?: string;
	}[];
	awards?: {
		title: string;
		date: string;
		awarder: string;
		summary?: string;
	}[];
	meta?: {
		sectionOrder?: ResumeSection[];
		hiddenSections?: ResumeSection[];
	};
}

export const sampleResume: JSONResume = {
	basics: {
		name: "Alex Johnson",
		label: "Senior Software Engineer",
		email: "alex.johnson@email.com",
		phone: "(555) 123-4567",
		url: "https://alexjohnson.dev",
		summary:
			"Results-driven software engineer with 6+ years of experience building scalable web applications. Specialized in React, TypeScript, and cloud architecture. Proven track record of leading teams to deliver high-impact products that drive business growth.",
		location: {
			city: "San Francisco",
			region: "CA",
			countryCode: "US",
		},
		profiles: [
			{
				network: "LinkedIn",
				username: "alexjohnson",
				url: "https://linkedin.com/in/alexjohnson",
			},
			{
				network: "GitHub",
				username: "alexjdev",
				url: "https://github.com/alexjdev",
			},
		],
	},
	work: [
		{
			name: "TechCorp Inc.",
			position: "Senior Software Engineer",
			url: "https://techcorp.io",
			startDate: "2021-03",
			summary: "Led frontend architecture for flagship SaaS product",
			highlights: [
				"Architected and led migration from legacy jQuery codebase to React/TypeScript, reducing bundle size by 45%",
				"Mentored team of 4 junior engineers, establishing code review practices that improved PR turnaround by 60%",
				"Implemented CI/CD pipeline with GitHub Actions, reducing deployment time from 2 hours to 15 minutes",
				"Collaborated with product team to redesign dashboard UI, increasing user engagement by 35%",
			],
		},
		{
			name: "StartupXYZ",
			position: "Full Stack Developer",
			url: "https://startupxyz.com",
			startDate: "2019-01",
			endDate: "2021-02",
			summary: "Core developer for B2B analytics platform",
			highlights: [
				"Built real-time data visualization dashboard serving 10K+ daily active users",
				"Designed RESTful APIs handling 1M+ requests/day with 99.9% uptime",
				"Reduced page load time by 70% through code splitting and lazy loading",
				"Integrated Stripe payment system processing $2M+ annual transactions",
			],
		},
		{
			name: "Digital Agency Co.",
			position: "Frontend Developer",
			startDate: "2017-06",
			endDate: "2018-12",
			highlights: [
				"Developed responsive websites for 20+ clients across various industries",
				"Created reusable component library reducing development time by 40%",
				"Implemented accessibility improvements achieving WCAG 2.1 AA compliance",
			],
		},
	],
	education: [
		{
			institution: "University of California, Berkeley",
			area: "Computer Science",
			studyType: "Bachelor of Science",
			startDate: "2013-08",
			endDate: "2017-05",
			score: "3.8 GPA",
			courses: [
				"Data Structures",
				"Algorithms",
				"Database Systems",
				"Web Development",
			],
		},
	],
	skills: [
		{
			name: "Frontend",
			level: "Expert",
			keywords: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Redux"],
		},
		{
			name: "Backend",
			level: "Advanced",
			keywords: ["Node.js", "Python", "PostgreSQL", "GraphQL", "REST APIs"],
		},
		{
			name: "DevOps & Tools",
			level: "Intermediate",
			keywords: ["AWS", "Docker", "Git", "CI/CD", "Terraform"],
		},
	],
	languages: [
		{ language: "English", fluency: "Native" },
		{ language: "Spanish", fluency: "Professional" },
	],
	certificates: [
		{
			name: "AWS Solutions Architect Associate",
			date: "2023-06",
			issuer: "Amazon Web Services",
		},
	],
	projects: [
		{
			name: "Open Source Contribution",
			description: "Major contributor to popular React component library",
			highlights: [
				"Implemented 5 new components with full TypeScript support",
				"Fixed 20+ bugs improving library stability",
			],
			keywords: ["React", "TypeScript", "Open Source"],
		},
	],
};
