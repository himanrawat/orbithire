import type { ReactNode } from "react";
import { brandFonts } from "@/app/fonts";
import "@/components/marketing/nextmilestone.css";
import { SiteHeader } from "@/components/marketing/site-header";

// Sign in and sign up share the marketing site's fonts, tokens and navbar.
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<div className={`nm ${brandFonts} flex min-h-screen flex-col overflow-x-clip`}>
			<SiteHeader />
			<main id="main" className="flex flex-1">
				{children}
			</main>
		</div>
	);
}
