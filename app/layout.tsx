import "./globals.css";
import "@/components/marketing/nextmilestone.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { brandFonts } from "@/app/fonts";

const TITLE = "NextMilestone: know your next step";
const DESCRIPTION =
	"NextMilestone puts the one most useful career step at the top of your day, from first internship to leadership. Learn, practice, focus, find the right role and share progress, in one place.";

export const metadata: Metadata = {
	metadataBase: new URL("https://resume.himanshurawat.in"),
	title: { default: TITLE, template: "%s | NextMilestone" },
	description: DESCRIPTION,
	applicationName: "NextMilestone",
	keywords: ["career plan", "interview prep", "job search", "learning path", "focus timer", "AI resume"],
	openGraph: {
		title: TITLE,
		description: DESCRIPTION,
		siteName: "NextMilestone",
		images: [{ url: "/og.png", width: 1200, height: 630, alt: "NextMilestone: know your next step. Then take it." }],
	},
	twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
	icons: {
		icon: [
			{ url: "/brand/favicon.svg", type: "image/svg+xml" },
			{ url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
			{ url: "/brand/favicon-16.png", sizes: "16x16", type: "image/png" },
		],
		apple: "/brand/apple-touch-icon.png",
	},
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" className={brandFonts} suppressHydrationWarning>
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
