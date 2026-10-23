import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://resume.himanshurawat.in";

	return [
		{
			url: `${baseUrl}/`,
			changeFrequency: "weekly",
			priority: 1,
		},
		...["/product/today", "/product/interview-prep", "/product/focus", "/product/jobs-and-learning", "/community", "/pricing", "/faq", "/contact", "/privacy", "/terms"].map(
			(path) => ({
				url: `${baseUrl}${path}`,
				changeFrequency: "monthly" as const,
				priority: 0.9,
			}),
		),
		{
			url: `${baseUrl}/signup`,
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/signin`,
			changeFrequency: "monthly",
			priority: 0.6,
		},
	];
}
