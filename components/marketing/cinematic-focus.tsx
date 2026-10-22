"use client";

// Adapted from 21st.dev jahed/cinematic-landing-hero: a pinned scroll timeline where an ink card
// rises over the headline, fills the screen, shows the phone, then pulls back to the closing
// call to action. Recoloured to the NextMilestone tokens, printed with the site grain, and
// with the silver text, emoji and app-store buttons replaced by the brand's own parts.

import React, { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BellOff, Timer } from "lucide-react";
import { Btn } from "./btn";
import { Mark } from "./logo";

if (typeof window !== "undefined") {
	gsap.registerPlugin(ScrollTrigger);
}

const STYLES = `
  .cf .gsap-reveal { visibility: hidden; }
  .cf .bg-grid {
      background-size: 60px 60px;
      background-image:
          linear-gradient(to right, color-mix(in srgb, var(--ink) 6%, transparent) 1px, transparent 1px),
          linear-gradient(to bottom, color-mix(in srgb, var(--ink) 6%, transparent) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
      -webkit-mask-image: radial-gradient(ellipse at center, black 0%, transparent 70%);
  }
  .cf .depth-card {
      background: var(--night);
      color: var(--night-ink);
      box-shadow: 0 40px 100px -20px rgba(0,0,0,.55), 0 20px 40px -20px rgba(0,0,0,.45), inset 0 1px 2px rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.04);
  }
  .cf .card-sheen {
      position: absolute; inset: 0; border-radius: inherit; pointer-events: none; z-index: 2;
      background: radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255,255,255,.06) 0%, transparent 40%);
      mix-blend-mode: screen;
  }
  .cf .bezel {
      background-color: #111;
      box-shadow: inset 0 0 0 2px #52525b, inset 0 0 0 7px #000, 0 40px 80px -15px rgba(0,0,0,.9), 0 15px 25px -5px rgba(0,0,0,.7);
      transform-style: preserve-3d;
  }
  .cf .hw-btn { background: #2a2c31; box-shadow: -2px 0 5px rgba(0,0,0,.8); }
  .cf .glare { background: linear-gradient(110deg, rgba(255,255,255,.07) 0%, rgba(255,255,255,0) 45%); }
  .cf .widget { background: var(--night-raised); border: 1px solid var(--night-line); }
  .cf .badge {
      background: color-mix(in srgb, var(--surface) 82%, transparent);
      color: var(--ink);
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--line);
      box-shadow: var(--shadow-float);
  }
  .cf .ring { transform: rotate(-90deg); transform-origin: center; stroke-dasharray: 402; stroke-dashoffset: 402; stroke-linecap: round; }
`;

// 4 h 10 min against a 6 h goal: 250 of 360 minutes
const MINUTES = 250;
const GOAL = 360;
const RING_END = Math.round(402 * (1 - MINUTES / GOAL));

function useReducedMotion() {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const mq = matchMedia("(prefers-reduced-motion: reduce)");
		const on = () => setReduced(mq.matches);
		on();
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, []);
	return reduced;
}

function Phone({ still }: Readonly<{ still?: boolean }>) {
	return (
		<div className="bezel relative flex h-[580px] w-[280px] flex-col rounded-[3rem] will-change-transform">
			<div className="hw-btn absolute -left-[3px] top-[120px] h-[25px] w-[3px] rounded-l-md" aria-hidden="true" />
			<div className="hw-btn absolute -left-[3px] top-[160px] h-[45px] w-[3px] rounded-l-md" aria-hidden="true" />
			<div className="hw-btn absolute -right-[3px] top-[170px] h-[70px] w-[3px] rounded-r-md" aria-hidden="true" />

			<div className="nm-grain absolute inset-[7px] overflow-hidden rounded-[2.5rem] bg-[var(--night)] text-[var(--night-ink)] [--grain-o:.35]">
				<div className="glare pointer-events-none absolute inset-0 z-[3]" aria-hidden="true" />
				<div className="absolute left-1/2 top-[5px] z-[3] h-[28px] w-[100px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />

				<div className="relative z-[2] flex h-full w-full flex-col px-5 pb-8 pt-12">
					<div className="phone-widget mb-7 flex items-center justify-between">
						<div className="flex flex-col">
							<span className="mb-1 text-[11px] font-semibold text-[var(--night-muted)]">Focus · this week</span>
							<span className="nm-display text-xl font-[650] tracking-[-0.015em]">4 h 10 min</span>
						</div>
						<Mark className="h-8 w-auto" stone="var(--night-ink)" />
					</div>

					<div className="phone-widget relative mx-auto mb-7 flex h-44 w-44 items-center justify-center">
						<svg className="absolute inset-0 h-full w-full" aria-hidden="true">
							<circle cx="88" cy="88" r="64" fill="none" stroke="var(--night-line)" strokeWidth="12" />
							<circle
								className="ring"
								cx="88"
								cy="88"
								r="64"
								fill="none"
								stroke="var(--cap)"
								strokeWidth="12"
								style={still ? { strokeDashoffset: RING_END } : undefined}
							/>
						</svg>
						<div className="z-10 flex flex-col items-center text-center">
							<span className="counter nm-mono text-4xl font-semibold tracking-[-0.02em]">{still ? MINUTES : 0}</span>
							<span className="mt-0.5 text-[11px] font-medium text-[var(--night-muted)]">of {GOAL} min goal</span>
						</div>
					</div>

					<div className="space-y-3">
						<div className="phone-widget widget flex items-center gap-3 rounded-2xl p-3">
							<span className="grid size-10 flex-none place-items-center rounded-xl bg-[var(--night)] text-[var(--cap)]">
								<Timer size={18} strokeWidth={1.75} />
							</span>
							<span className="text-[13px] leading-[18px]">
								<b className="block font-semibold">Lesson 7: queues</b>
								<span className="nm-mono text-[var(--night-muted)]">31:12 left of 50</span>
							</span>
						</div>
						<div className="phone-widget widget flex items-center gap-3 rounded-2xl p-3">
							<span className="grid size-10 flex-none place-items-center rounded-xl bg-[var(--night)] text-[var(--night-muted)]">
								<BellOff size={18} strokeWidth={1.75} />
							</span>
							<span className="text-[13px] leading-[18px]">
								<b className="block font-semibold">Notifications held</b>
								<span className="nm-mono text-[var(--night-muted)]">until 8:20 AM</span>
							</span>
						</div>
					</div>

					<div className="absolute bottom-2 left-1/2 h-1 w-[120px] -translate-x-1/2 rounded-full bg-white/20" />
				</div>
			</div>
		</div>
	);
}

function Badges() {
	return (
		<>
			<div className="floating-badge badge absolute left-[-15px] top-6 z-30 flex items-center gap-3 rounded-xl p-3 lg:left-[-80px] lg:top-12 lg:gap-4 lg:rounded-2xl lg:p-4">
				<span className="grid size-8 place-items-center rounded-full bg-[var(--cap-soft)] lg:size-10">
					<Mark className="h-5 w-auto lg:h-6" />
				</span>
				<div>
					<p className="text-xs font-semibold lg:text-sm">Milestone reached</p>
					<p className="text-[11px] text-[var(--ink-muted)] lg:text-xs">Finished Frontend interview basics</p>
				</div>
			</div>
			<div className="floating-badge badge absolute bottom-0 right-[-15px] z-30 flex items-center gap-3 rounded-xl p-3 lg:bottom-20 lg:right-[-80px] lg:gap-4 lg:rounded-2xl lg:p-4">
				<span className="grid size-8 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)] lg:size-10">
					<Timer size={18} strokeWidth={1.75} />
				</span>
				<div>
					<p className="text-xs font-semibold lg:text-sm">2 of 5 done today</p>
					<p className="text-[11px] text-[var(--ink-muted)] lg:text-xs">Next: practice a stakeholder question</p>
				</div>
			</div>
		</>
	);
}

function CardCopy() {
	return (
		<>
			<h3 className="nm-display mb-0 text-2xl font-[680] tracking-[-0.02em] md:text-3xl lg:mb-5 lg:text-4xl">
				Protected time, not more reminders.
			</h3>
			<p className="mx-auto hidden max-w-sm text-base leading-relaxed text-[var(--night-muted)] md:block lg:mx-0 lg:max-w-none lg:text-lg">
				Start a 25, 50 or 90 minute session tied to one task. NextMilestone holds its own notifications until you&apos;re
				done, and counts the minutes against a goal you set. No streaks to break.
			</p>
		</>
	);
}

function Closing({ redirectQuery }: Readonly<{ redirectQuery: string }>) {
	return (
		<>
			<div className="nm-grain mx-auto mb-8 grid w-[96px] gap-2 [--grain-o:.5]" aria-hidden="true">
				<div className="nm-arch h-12 bg-[var(--cap)]" />
				<div className="grid h-24 place-items-center bg-[var(--ink)]">
					<span className="nm-display text-[22px] tracking-[-0.02em] text-[var(--paper)]">2 min</span>
				</div>
			</div>
			<h2 className="nm-display mb-6 text-[44px] leading-[44px] tracking-[-0.03em] md:text-6xl lg:text-[88px] lg:leading-[84px]">
				Your plan is two minutes away.
			</h2>
			<p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[var(--ink-muted)] md:text-xl">
				Pick your stage and what you&apos;re working towards. Every step can be skipped, and you can import a resume to
				fill in the rest.
			</p>
			<div className="flex flex-col justify-center gap-3 sm:flex-row">
				<Btn href={`/signup${redirectQuery}`} arrow className="justify-center">
					Get started
				</Btn>
				<Btn href={`/signup${redirectQuery}`} variant="secondary" className="justify-center">
					Import a resume first
				</Btn>
			</div>
		</>
	);
}

export function CinematicFocus({ redirectQuery }: Readonly<{ redirectQuery: string }>) {
	const still = useReducedMotion();
	const containerRef = useRef<HTMLDivElement>(null);
	const mainCardRef = useRef<HTMLDivElement>(null);
	const mockupRef = useRef<HTMLDivElement>(null);
	const requestRef = useRef<number>(0);

	// pointer lighting on the card and tilt on the phone
	useEffect(() => {
		if (still) return;
		const onMove = (e: MouseEvent) => {
			cancelAnimationFrame(requestRef.current);
			requestRef.current = requestAnimationFrame(() => {
				const card = mainCardRef.current;
				const phone = mockupRef.current;
				if (!card || !phone) return;
				const rect = card.getBoundingClientRect();
				if (rect.bottom < 0 || rect.top > window.innerHeight) return;
				card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
				card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
				const x = (e.clientX / window.innerWidth - 0.5) * 2;
				const y = (e.clientY / window.innerHeight - 0.5) * 2;
				gsap.to(phone, { rotationY: x * 10, rotationX: -y * 10, ease: "power3.out", duration: 1.2 });
			});
		};
		window.addEventListener("mousemove", onMove);
		return () => {
			window.removeEventListener("mousemove", onMove);
			cancelAnimationFrame(requestRef.current);
		};
	}, [still]);

	// the scroll timeline
	useEffect(() => {
		if (still) return;
		const isMobile = window.innerWidth < 768;
		const ctx = gsap.context(() => {
			gsap.set(".text-track", { autoAlpha: 0, y: 60, scale: 0.9, filter: "blur(16px)" });
			gsap.set(".text-days", { autoAlpha: 1, clipPath: "inset(0 100% 0 0)" });
			gsap.set(".main-card", { y: window.innerHeight + 200, autoAlpha: 1 });
			gsap.set([".card-left-text", ".card-right-text", ".mockup-wrap", ".floating-badge", ".phone-widget"], { autoAlpha: 0 });
			gsap.set(".cta-wrap", { autoAlpha: 0, scale: 0.85, filter: "blur(24px)" });

			gsap
				.timeline({ scrollTrigger: { trigger: containerRef.current, start: "top 70%", once: true } })
				.to(".text-track", { duration: 1.6, autoAlpha: 1, y: 0, scale: 1, filter: "blur(0px)", ease: "expo.out" })
				.to(".text-days", { duration: 1.2, clipPath: "inset(0 0% 0 0)", ease: "power4.inOut" }, "-=1.0");

			gsap
				.timeline({
					scrollTrigger: { trigger: containerRef.current, start: "top top", end: "+=4200", pin: true, scrub: 1, anticipatePin: 1 },
				})
				.to([".hero-text", ".bg-grid"], { scale: 1.12, filter: "blur(16px)", opacity: 0.2, ease: "power2.inOut", duration: 2 }, 0)
				.to(".main-card", { y: 0, ease: "power3.inOut", duration: 2 }, 0)
				.to(".main-card", { width: "100%", height: "100%", borderRadius: "0px", ease: "power3.inOut", duration: 1.5 })
				.fromTo(
					".mockup-wrap",
					{ y: 300, z: -500, rotationX: 50, rotationY: -30, autoAlpha: 0, scale: 0.6 },
					{ y: 0, z: 0, rotationX: 0, rotationY: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 2.5 },
					"-=0.8",
				)
				.fromTo(".phone-widget", { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.15, ease: "power3.out", duration: 1.5 }, "-=1.5")
				.to(".ring", { strokeDashoffset: RING_END, duration: 2, ease: "power3.inOut" }, "-=1.2")
				.to(".counter", { innerHTML: MINUTES, snap: { innerHTML: 1 }, duration: 2, ease: "expo.out" }, "-=2.0")
				.fromTo(".floating-badge", { y: 100, autoAlpha: 0, scale: 0.8 }, { y: 0, autoAlpha: 1, scale: 1, ease: "back.out(1.4)", duration: 1.5, stagger: 0.2 }, "-=2.0")
				.fromTo(".card-left-text", { x: -50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power4.out", duration: 1.5 }, "-=1.5")
				.fromTo(".card-right-text", { x: 50, autoAlpha: 0, scale: 0.85 }, { x: 0, autoAlpha: 1, scale: 1, ease: "expo.out", duration: 1.5 }, "<")
				.to({}, { duration: 2 })
				.set(".hero-text", { autoAlpha: 0 })
				.set(".cta-wrap", { autoAlpha: 1 })
				.to({}, { duration: 1 })
				.to([".mockup-wrap", ".floating-badge", ".card-left-text", ".card-right-text"], {
					scale: 0.9,
					y: -40,
					z: -200,
					autoAlpha: 0,
					ease: "power3.in",
					duration: 1.2,
					stagger: 0.05,
				})
				.to(
					".main-card",
					{ width: isMobile ? "92vw" : "85vw", height: isMobile ? "92vh" : "85vh", borderRadius: isMobile ? "32px" : "40px", ease: "expo.inOut", duration: 1.8 },
					"pullback",
				)
				.to(".cta-wrap", { scale: 1, filter: "blur(0px)", ease: "expo.inOut", duration: 1.8 }, "pullback")
				.to(".main-card", { y: -window.innerHeight - 300, ease: "power3.in", duration: 1.5 });
		}, containerRef);
		return () => ctx.revert();
	}, [still]);

	// Reduced motion: the same parts, stacked and still.
	if (still) {
		return (
			<section id="focus" aria-labelledby="h-focus" className="cf py-14 md:py-[104px]">
				<style dangerouslySetInnerHTML={{ __html: STYLES }} />
				<div className="nm-wrap">
					<h2 id="h-focus" className="sr-only">
						Protected time, not more reminders.
					</h2>
					<div className="depth-card nm-grain grid items-center gap-10 overflow-hidden rounded-[32px] p-8 [--grain-o:.5] lg:grid-cols-[1fr_auto] lg:p-14">
						<div className="relative z-[3]">
							<CardCopy />
						</div>
						<div className="relative z-[3] mx-auto">
							<Phone still />
						</div>
					</div>
					<div className="mt-24 text-center">
						<Closing redirectQuery={redirectQuery} />
					</div>
				</div>
			</section>
		);
	}

	return (
		<section
			id="focus"
			aria-labelledby="h-focus"
			ref={containerRef}
			className="cf relative flex h-screen w-full items-center justify-center overflow-hidden"
			style={{ perspective: "1500px" }}
		>
			<style dangerouslySetInnerHTML={{ __html: STYLES }} />
			<div className="bg-grid pointer-events-none absolute inset-0 z-0 opacity-60" aria-hidden="true" />

			{/* behind: the headline */}
			<div className="hero-text absolute z-10 flex w-full flex-col items-center justify-center px-4 text-center">
				<h2 id="h-focus" className="nm-display">
					<span className="text-track gsap-reveal block text-5xl tracking-[-0.03em] md:text-7xl lg:text-[96px] lg:leading-[88px]">
						Protected time,
					</span>
					<span className="text-days gsap-reveal block text-5xl font-normal tracking-[-0.03em] text-[var(--ink-muted)] md:text-7xl lg:text-[96px] lg:leading-[88px]">
						not more reminders.
					</span>
				</h2>
			</div>

			{/* behind: the closing call to action */}
			<div className="cta-wrap gsap-reveal pointer-events-auto absolute z-10 flex w-full flex-col items-center justify-center px-4 text-center">
				<Closing redirectQuery={redirectQuery} />
			</div>

			{/* in front: the ink card */}
			<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" style={{ perspective: "1500px" }}>
				<div
					ref={mainCardRef}
					className="main-card depth-card nm-grain gsap-reveal pointer-events-auto relative flex h-[92vh] w-[92vw] items-center justify-center overflow-hidden rounded-[32px] [--grain-o:.5] md:h-[85vh] md:w-[85vw] md:rounded-[40px]"
				>
					<div className="card-sheen" aria-hidden="true" />
					<div className="relative z-[3] mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-evenly px-4 py-6 lg:grid lg:grid-cols-3 lg:gap-8 lg:px-12 lg:py-0">
						<div className="card-right-text gsap-reveal order-1 flex w-full justify-center lg:order-3 lg:justify-end">
							<p className="nm-mono text-6xl font-semibold tracking-[-0.04em] text-[var(--cap)] md:text-[6rem] lg:text-[7.5rem]" aria-hidden="true">
								50:00
							</p>
						</div>

						<div className="mockup-wrap order-2 relative flex h-[380px] w-full items-center justify-center lg:h-[600px]" style={{ perspective: "1000px" }}>
							<div className="relative flex h-full w-full scale-[0.65] items-center justify-center md:scale-[0.85] lg:scale-100">
								<div ref={mockupRef} className="relative" style={{ transformStyle: "preserve-3d" }}>
									<Phone />
								</div>
								<Badges />
							</div>
						</div>

						<div className="card-left-text gsap-reveal order-3 flex w-full flex-col justify-center px-4 text-center lg:order-1 lg:px-0 lg:text-left">
							<CardCopy />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
