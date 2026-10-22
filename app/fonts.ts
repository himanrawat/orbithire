import localFont from "next/font/local";

// The three NextMilestone families, bundled so every platform renders the same letters.
export const display = localFont({
	src: "./fonts/AnekLatinWide-Variable.woff2",
	weight: "100 800",
	variable: "--font-display",
	display: "swap",
});

export const text = localFont({
	src: [
		{ path: "./fonts/HostGrotesk-Variable.woff2", weight: "300 800", style: "normal" },
		{ path: "./fonts/HostGrotesk-Italic-Variable.woff2", weight: "300 800", style: "italic" },
	],
	variable: "--font-text",
	display: "swap",
});

export const mono = localFont({
	src: "./fonts/GeistMono-Variable.woff2",
	weight: "100 900",
	variable: "--font-mono",
	display: "swap",
});

export const brandFonts = `${display.variable} ${text.variable} ${mono.variable}`;
