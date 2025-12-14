"use client";

import { FormEvent, Suspense, useState } from "react";
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
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import { sanitizeRedirect } from "@/lib/auth-utils";

const steps = [
	{
		number: "1",
		title: "Create your account",
		description: "Sign up in seconds with just your email",
	},
	{
		number: "2",
		title: "Paste a job description",
		description: "Get a tailored resume and cover letter instantly",
	},
	{
		number: "3",
		title: "Stay organized",
		description: "Track applications and never miss a follow-up",
	},
];

function SignUpContent() {
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();
	const searchParams = useSearchParams();

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setNotice(null);
		setLoading(true);

		const formData = new FormData(event.currentTarget);
		const email = (formData.get("email") || "").toString().trim();
		const password = (formData.get("password") || "").toString();

		const response = await fetch("/api/auth/signup", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		});

		const body = await response.json().catch(() => ({}));

		if (!response.ok) {
			setError(body.error || "Unable to sign up. Please try again.");
			setLoading(false);
			return;
		}

		if (body.requiresEmailConfirmation) {
			setNotice(
				"Check your email to confirm your account, then sign in to continue."
			);
			setLoading(false);
			return;
		}

		// Cookies are set by the API route, just navigate
		const redirect = sanitizeRedirect(
			searchParams.get("redirect"),
			"/onboarding"
		);
		router.push(redirect);
	}

	const redirect = searchParams.get("redirect");
	const signinHref = redirect
		? `/signin?redirect=${encodeURIComponent(redirect)}`
		: "/signin";

	return (
		<div className="min-h-screen">
			<NavBar user={null} />
			<GridBackground />

			<div className="container relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
				<div className="grid w-full max-w-5xl gap-8 lg:grid-cols-2 lg:gap-12">
					{/* Left side - Info */}
					<motion.div
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.4 }}
						className="hidden items-center lg:flex"
					>
						<div className="space-y-8">
							<div>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
									<Sparkles className="h-6 w-6 text-primary" />
								</div>
								<h2 className="text-3xl font-bold tracking-tight">
									Start landing more interviews
								</h2>
								<p className="mt-2 text-muted-foreground">
									Join thousands of job seekers who have streamlined their
									application process.
								</p>
							</div>
							<div className="space-y-4">
								{steps.map((step, index) => (
									<motion.div
										key={step.number}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
										className="flex gap-4"
									>
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-medium">
											{step.number}
										</div>
										<div>
											<h3 className="font-medium">{step.title}</h3>
											<p className="text-sm text-muted-foreground">
												{step.description}
											</p>
										</div>
									</motion.div>
								))}
							</div>
						</div>
					</motion.div>

					{/* Right side - Form */}
					<motion.div
						initial={{ opacity: 0, x: 20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.4, delay: 0.1 }}
						className="flex items-center justify-center lg:justify-start"
					>
						<Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
							<CardHeader className="space-y-1">
								<CardTitle className="text-2xl font-bold">
									Create an account
								</CardTitle>
								<CardDescription>
									Get started with OrbitHire for free
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
											placeholder="At least 8 characters"
											required
											disabled={loading}
											minLength={8}
										/>
									</div>
									{error && (
										<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
											{error}
										</div>
									)}
									{notice && (
										<div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
											{notice}
										</div>
									)}
								</CardContent>
								<CardFooter className="flex flex-col space-y-4">
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Creating account...
											</>
										) : (
											<>
												Create account
												<ArrowRight className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>
									<p className="text-center text-sm text-muted-foreground">
										Already have an account?{" "}
										<Link
											href={signinHref}
											className="font-medium text-primary underline-offset-4 hover:underline"
										>
											Sign in
										</Link>
									</p>
								</CardFooter>
							</form>
						</Card>
					</motion.div>
				</div>
			</div>
		</div>
	);
}

export default function SignUpPage() {
	return (
		<Suspense fallback={<div className="min-h-screen" />}>
			<SignUpContent />
		</Suspense>
	);
}
