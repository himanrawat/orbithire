import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and linked from every page by Next. The service worker
// (public/sw.js) precaches this file and /offline.
export default function manifest(): MetadataRoute.Manifest {
	return {
		id: "/dashboard",
		name: "NextMilestone",
		short_name: "NextMilestone",
		description: "Know your next step. Then take it.",
		start_url: "/dashboard",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#101216",
		theme_color: "#101216",
		categories: ["productivity", "education", "business"],
		icons: [
			{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
		shortcuts: [
			{
				name: "Today",
				short_name: "Today",
				description: "Your plan for today",
				url: "/dashboard",
				icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
			},
			{
				name: "Log what you learned",
				short_name: "Log",
				description: "Add a link or note to your learning log",
				url: "/learn?tab=log",
				icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
			},
			{
				name: "Start a focus session",
				short_name: "Focus",
				description: "Open the focus timer",
				url: "/focus",
				icons: [{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
			},
		],
	};
}
