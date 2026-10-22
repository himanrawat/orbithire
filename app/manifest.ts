import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest and linked from every page by Next.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "NextMilestone",
		short_name: "NextMilestone",
		description: "Know your next step. Then take it.",
		start_url: "/dashboard",
		display: "standalone",
		background_color: "#101216",
		theme_color: "#101216",
		icons: [
			{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
			{ src: "/brand/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
	};
}
