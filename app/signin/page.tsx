"use client";

import { FormEvent, Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GridBackground } from "@/components/ui/aceternity";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

const features = [
	"Tailored resumes from job descriptions",
	"Organized company folders",
	"Smart follow-up reminders",
];

export default function SignInPage() {
	return (
		<Suspense fallback={<div className="min-h-screen" />}>
			<SignInContent />
		</Suspense>
	);
}

/**
 * Check if any Supabase session cookie exists (client-side).
 */
function hasSupabaseSessionCookie(): boolean {
	if (typeof document === "undefined") return false;
	const cookies = document.cookie;
	return /sb-[^=]+-auth-token/.test(cookies) || 
	       cookies.includes("sb-access-token") || 
	       cookies.includes("sb-refresh-token");
}

function SignInContent() {
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();

	// Redirect to dashboard if already signed in
	useEffect(() => {
		if (hasSupabaseSessionCookie()) {
			router.replace("/dashboard");
		}
	}, [router]);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setLoading(true);

		const formData = new FormData(event.currentTarget);
		const email = (formData.get("email") || "").toString().trim();
		const password = (formData.get("password") || "").toString();

		const response = await fetch("/api/auth/signin", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		if (!response.ok) {
			const body = await response.json().catch(() => ({}));
			setError(body.error || "Unable to sign in. Please try again.");
			setLoading(false);
			return;
		}

		// Use router.refresh() to update middleware state, then navigate
		const redirect = searchParams.get("redirect") || "/dashboard";
		router.refresh();
		router.push(redirect);
	}

	return (
		<div className="min-h-screen">
			<NavBar user={null} />
			<GridBackground />

			<div className="container relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
				<div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:gap-12">
					{/* Left side - Form */}
					<motion.div
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.4 }}
						className="flex items-center justify-center lg:justify-end"
					>
						<Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="space-y-1">
								<CardTitle className="text-2xl font-bold">
									Welcome back
								</CardTitle>
								<CardDescription>
									Sign in to your OrbitHire account
								</CardDescription>
							</CardHeader>
							<form onSubmit={handleSubmit}>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											name="email"
											type="email"
											placeholder="you@example.com"
											required
											disabled={loading}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="password">Password</Label>
										<Input
											id="password"
											name="password"
											type="password"
											placeholder="••••••••"
											required
											disabled={loading}
										/>
									</div>
									{error && (
										<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
											{error}
										</div>
									)}
								</CardContent>
								<CardFooter className="flex flex-col space-y-4">
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Signing in...
											</>
										) : (
											<>
												Sign in
												<ArrowRight className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>
									<p className="text-center text-sm text-muted-foreground">
										Don&apos;t have an account?{" "}
										<Link
											href="/signup"
											className="font-medium text-primary underline-offset-4 hover:underline"
										>
											Create one
										</Link>
									</p>
								</CardFooter>
							</form>
						</Card>
					</motion.div>

					{/* Right side - Info */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.4, delay: 0.1 }}
						className="hidden items-center lg:flex"
					>
						<div className="space-y-6">
							<div>
								<h2 className="text-3xl font-bold tracking-tight">
									Your job search, organized
								</h2>
								<p className="mt-2 text-muted-foreground">
									Access your dashboard and pick up where you left off.
								</p>
							</div>
							<ul className="space-y-3">
								{features.map((feature) => (
									<li key={feature} className="flex items-center gap-3">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
											<CheckCircle2 className="h-4 w-4 text-primary" />
										</div>
										<span className="text-sm">{feature}</span>
									</li>
								))}
							</ul>
						</div>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
