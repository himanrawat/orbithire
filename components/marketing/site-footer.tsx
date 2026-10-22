"use client";

// The 21st.dev kedhareswer/pushpin-tear-footer in NextMilestone dress: an ink sheet torn away
// from a cap-yellow pin (the milestone's cap, and the only yellow on the screen), the wordmark
// printed on the paper underneath, and the site's shared grain on both.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { Mark } from "./logo";

const PushpinTearFooter = dynamic(() => import("@/components/ui/pushpin-tear-footer"), {
	ssr: false,
	loading: () => <div className="min-h-[640px] bg-[#101216]" aria-hidden="true" />,
});

// Shown by the copy-email button.
const CONTACT_EMAIL = "info@himanshurawat.in";

const LIGHT = { sheet: "#101216", sheetInk: "#F4F5F2", paper: "#F4F5F2", paperInk: "#101216" };
const DARK = { sheet: "#1E2126", sheetInk: "#ECEDE9", paper: "#0D0E11", paperInk: "#ECEDE9" };

export function SiteFooter({ redirectQuery }: Readonly<{ redirectQuery: string }>) {
	const router = useRouter();
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const c = mounted && resolvedTheme === "dark" ? DARK : LIGHT;

	const signup = `/signup${redirectQuery}`;
	const withEmail = (email: string) => {
		const q = new URLSearchParams(redirectQuery.slice(1));
		q.set("email", email);
		return `/signup?${q}`;
	};

	return (
		<PushpinTearFooter
			brand={
				<>
					{/* not spans: the footer sets every span inside the wordmark to block */}
					<b style={{ fontWeight: 700 }}>next</b>
					<em style={{ fontWeight: 400, fontStyle: "normal" }}>milestone</em>
				</>
			}
			name="NextMilestone"
			logo={<Mark className="block h-[2.6em] w-auto" stone={c.sheetInk} />}
			logoHref="/"
			socials={[]}
			email={CONTACT_EMAIL}
			newsletter={{ label: "Start with your email", placeholder: "you@email.com" }}
			sentLabel="taking you to sign up"
			onSubscribe={(email) => window.setTimeout(() => router.push(withEmail(email)), 600)}
			status={{ label: "Early access · US first", href: signup }}
			seal={false}
			mark="NM / 2026"
			timeZone="America/New_York"
			timeLabel="ET"
			columns={[
				{
					title: "Product",
					links: [
						{ label: "Today", href: "/product/today" },
						{ label: "Interview prep", href: "/product/interview-prep" },
						{ label: "Focus", href: "/product/focus" },
						{ label: "Jobs and learning", href: "/product/jobs-and-learning" },
					],
					cta: { label: "Start.", href: signup },
				},
				{
					title: "Company",
					links: [
						{ label: "Community", href: "/community" },
						{ label: "Questions", href: "/faq" },
						{ label: "Privacy", href: "/privacy" },
						{ label: "Terms", href: "/terms" },
					],
					cta: { label: "Talk.", href: "/contact" },
				},
			]}
			chat={{ label: "Write to us", href: "/contact" }}
			sideLinks={[
				{ icon: "shield", label: "Privacy", href: "/privacy" },
				{ icon: "doc", label: "Terms", href: "/terms" },
			]}
			copyright="© 2026 NextMilestone"
			credit="United States · Canada · UK · Europe · Australia"
			handle={{ label: "Sign in", href: `/signin${redirectQuery}` }}
			sheet={c.sheet}
			sheetInk={c.sheetInk}
			paper={c.paper}
			paperInk={c.paperInk}
			pinColor="#FFC21A"
			grainSrc="/textures/grain.png"
			height="max(640px, 92svh)"
			fontSans='var(--font-text), "Host Grotesk", system-ui, sans-serif'
			className="nm-footer"
		/>
	);
}
