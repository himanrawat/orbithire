import type { Metadata } from "next";
import { sanitizeRedirect } from "@/lib/auth-utils";
import { brandFonts } from "@/app/fonts";
import "@/components/marketing/nextmilestone.css";
import { SiteHeader } from "@/components/marketing/site-header";
import { Hero } from "@/components/marketing/hero";
import { TodaySection } from "@/components/marketing/today-section";
import { FeatureAreas } from "@/components/marketing/feature-areas";
import { PrepSection } from "@/components/marketing/prep-section";
import { CinematicFocus } from "@/components/marketing/cinematic-focus";
import { CommunitySection } from "@/components/marketing/community-section";
import { Faq } from "@/components/marketing/faq";
import { FAQS } from "@/components/marketing/faq-data";
import { SiteFooter } from "@/components/marketing/site-footer";
import { OG_IMAGES } from "@/components/marketing/marketing-shell";

type SearchParams = {
	[key: string]: string | string[] | undefined;
};

const TITLE = "NextMilestone: know your next step";
const DESCRIPTION =
	"NextMilestone puts the one most useful career step at the top of your day, from first internship to leadership. Learn, practice, focus, find the right role and share progress, in one place.";

export const metadata: Metadata = {
	title: { absolute: TITLE },
	description: DESCRIPTION,
	alternates: { canonical: "/" },
	openGraph: { url: "/", title: TITLE, description: DESCRIPTION, siteName: "NextMilestone", images: OG_IMAGES },
	twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

const structuredData = {
	"@context": "https://schema.org",
	"@graph": [
		{
			"@type": "SoftwareApplication",
			name: "NextMilestone",
			applicationCategory: "BusinessApplication",
			operatingSystem: "Web, iOS, Android",
			description: DESCRIPTION,
		},
		{
			"@type": "FAQPage",
			mainEntity: FAQS.map((f) => ({
				"@type": "Question",
				name: f.q,
				acceptedAnswer: { "@type": "Answer", text: f.a },
			})),
		},
	],
};

export default function LandingPage({ searchParams }: Readonly<{ searchParams?: SearchParams }>) {
	const redirectParam = searchParams?.redirect;
	const redirectValue = Array.isArray(redirectParam) ? redirectParam[0] : redirectParam || null;

	const safeRedirect = sanitizeRedirect(redirectValue, "");
	const redirectQuery = safeRedirect ? `?redirect=${encodeURIComponent(safeRedirect)}` : "";

	return (
		<div className={`nm ${brandFonts} min-h-screen overflow-x-clip`}>
			<a
				href="#main"
				className="absolute -top-16 left-4 z-[99] rounded-[var(--radius-control)] bg-[var(--ink)] px-3.5 py-2.5 text-[var(--paper)] focus:top-20"
			>
				Skip to content
			</a>
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />

			<SiteHeader redirectQuery={redirectQuery} />
			<main id="main">
				<Hero redirectQuery={redirectQuery} />
				<TodaySection />
				<FeatureAreas />
				<PrepSection />
				<CinematicFocus redirectQuery={redirectQuery} />
				<CommunitySection />
				<Faq />
			</main>
			<SiteFooter redirectQuery={redirectQuery} />
		</div>
	);
}
