import "./globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";

export const metadata = {
	title: "CVLeap AI",
	description: "ATS-ready resume tailoring, company folders, and follow-ups.",
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
