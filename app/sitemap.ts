import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://resume.himanshurawat.in";

	return [
		{
			url: `${baseUrl}/`,
			changeFrequency: "weekly",
			priority: 1,
		},
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
