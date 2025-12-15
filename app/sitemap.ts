import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://resume.himanshurawat.in";

	return [
		{
			url: `${baseUrl}/`,
			changefreq: "weekly",
			priority: 1,
		},
		{
			url: `${baseUrl}/signup`,
			changefreq: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/signin`,
			changefreq: "monthly",
			priority: 0.6,
		},
	];
}
