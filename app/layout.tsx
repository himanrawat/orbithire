import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata: Metadata = {
	metadataBase: new URL("https://resume.himanshurawat.in"),
	title: "CVLeap AI | ATS Resume Builder & Job Tracker",
	description:
		"Generate ATS-ready resumes, organize by company, and automate follow-ups with CVLeap AI.",
	keywords: [
		"ATS resume builder",
		"AI resume",
		"job application tracker",
		"cover letter generator",
		"follow-up email templates",
	],
	alternates: {
		canonical: "https://resume.himanshurawat.in/",
	},
	openGraph: {
		url: "https://resume.himanshurawat.in/",
		title: "CVLeap AI | ATS Resume Builder & Job Tracker",
		description:
			"Generate ATS-ready resumes, organize by company, and automate follow-ups with CVLeap AI.",
		siteName: "CVLeap AI",
		images: [
			{
				url: "/OG.png",
				width: 1200,
				height: 630,
				alt: "CVLeap AI — ATS Resume Builder & Job Tracker",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "CVLeap AI | ATS Resume Builder & Job Tracker",
		description:
			"Generate ATS-ready resumes, organize by company, and automate follow-ups with CVLeap AI.",
		images: ["/OG.png"],
	},
	icons: {
		icon: [
			{ url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
			{ url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon/favicon.ico" },
		],
		apple: "/favicon/apple-touch-icon.png",
		shortcut: "/favicon/favicon.ico",
	},
	manifest: "/favicon/site.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="min-h-screen antialiased" suppressHydrationWarning>
				<ThemeProvider
					attribute="class"
					defaultTheme="dark"
					enableSystem
					disableTransitionOnChange
				>
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
