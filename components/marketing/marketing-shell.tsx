// The frame every marketing page shares with the landing page: brand fonts and tokens, the
// skip link, the notch header and the torn-sheet footer.

import type { ReactNode } from "react";
import { sanitizeRedirect } from "@/lib/auth-utils";
import { brandFonts } from "@/app/fonts";
import "./nextmilestone.css";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

export type SearchParams = {
	[key: string]: string | string[] | undefined;
};

/** Carries a safe ?redirect= through to the sign-in and sign-up links. */
export function getRedirectQuery(searchParams?: SearchParams) {
	const redirectParam = searchParams?.redirect;
	const redirectValue = Array.isArray(redirectParam) ? redirectParam[0] : redirectParam || null;
	const safeRedirect = sanitizeRedirect(redirectValue, "");
	return safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : "";
}

export function MarketingShell({
	redirectQuery,
	structuredData,
	children,
}: Readonly<{
	redirectQuery: string;
	structuredData?: object;
	children: ReactNode;
}>) {
	return (
		<div className={`nm ${brandFonts} min-h-screen overflow-x-clip`}>
			<a
				href="#main"
				className="absolute -top-16 left-4 z-[99] rounded-[var(--radius-control)] bg-[var(--ink)] px-3.5 py-2.5 text-[var(--paper)] focus:top-20"
			>
				Skip to content
			</a>
			{structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />}

			<SiteHeader redirectQuery={redirectQuery} />
			<main id="main">{children}</main>
			<SiteFooter redirectQuery={redirectQuery} />
		</div>
	);
}

export const OG_IMAGES = [{ url: "/og.png", width: 1200, height: 630, alt: "NextMilestone: know your next step. Then take it." }];

/** Title, description, canonical and social cards for one marketing page. */
export function pageMetadata(path: string, title: string, description: string) {
	// Titles already name the brand, so they skip the root layout's "%s | NextMilestone" template.
	// Icons come from the root layout; the social image is repeated because openGraph replaces it.
	return {
		title: { absolute: title },
		description,
		alternates: { canonical: path },
		openGraph: { url: path, title, description, siteName: "NextMilestone", images: OG_IMAGES },
		twitter: { card: "summary_large_image" as const, title, description, images: ["/og.png"] },
	};
}
