"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GridBackground } from "@/components/ui/aceternity";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { sanitizeRedirect } from "@/lib/auth-utils";

const features = [
	{
		title: "AI-Powered Resumes",
		description: "Tailored to each job description in seconds.",
	},
	{
		title: "ATS-Optimized",
		description: "Pass screening algorithms with keyword matching.",
	},
	{
		title: "Track Applications",
		description: "Stay organized with company folders and reminders.",
	},
];

function SignInForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const signupHref = `/signup${
		searchParams.get("redirect")
			? `?redirect=${encodeURIComponent(searchParams.get("redirect")!)}`
			: ""
	}`;

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/signin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Sign in failed");
				return;
			}

			// Redirect to dashboard or the requested page
			const redirect = sanitizeRedirect(
				searchParams.get("redirect"),
				"/dashboard"
			);
			router.push(redirect);
			router.refresh();
		} catch {
			setError("Something went wrong");
		} finally {
			setLoading(false);
		}
	};

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
									Welcome back
								</h2>
								<p className="mt-2 text-muted-foreground">
									Sign in to continue crafting perfect resumes and tracking your
									applications.
								</p>
							</div>
							<div className="space-y-4">
								{features.map((feature, index) => (
									<motion.div
										key={feature.title}
										initial={{ opacity: 0, y: 10 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
										className="flex gap-4"
									>
										<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
											<Sparkles className="h-4 w-4 text-primary" />
										</div>
										<div>
											<h3 className="font-medium">{feature.title}</h3>
											<p className="text-sm text-muted-foreground">
												{feature.description}
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
								<CardTitle className="text-2xl font-bold">Sign in</CardTitle>
								<CardDescription>
									Enter your credentials to access your account
								</CardDescription>
							</CardHeader>
							<form onSubmit={handleSubmit}>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="you@example.com"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											required
											disabled={loading}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="password">Password</Label>
										<Input
											id="password"
											type="password"
											placeholder="••••••••"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
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
											href={signupHref}
											className="font-medium text-primary underline-offset-4 hover:underline"
										>
											Sign up
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

export default function SignInPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<SignInForm />
		</Suspense>
	);
}
