"use client";

import Script from "next/script";

declare global {
	interface Window {
		turnstile?: { reset: () => void };
	}
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function CaptchaField() {
	if (!siteKey) return null;
	return (
		<>
			<Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
			<div className="cf-turnstile" data-sitekey={siteKey} data-theme="auto" />
		</>
	);
}

export function captchaHeaders(): Record<string, string> {
	if (typeof document === "undefined") return {};
	const token = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value;
	return token ? { "X-Captcha-Token": token } : {};
}

export function resetCaptcha() {
	window.turnstile?.reset();
}
