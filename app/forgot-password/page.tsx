"use client";

import { useState, Suspense } from "react";
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
import { Mail, ArrowRight, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

function ForgotPasswordForm() {
	const [email, setEmail] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Failed to send reset email");
				return;
			}

			setSuccess(true);
		} catch {
			setError("Something went wrong");
		} finally {
			setLoading(false);
		}
	};

	if (success) {
		return (
			<div className="min-h-screen">
				<NavBar user={null} />
				<GridBackground />
				<div className="container relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.3 }}
					>
						<Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur text-center">
							<CardHeader className="space-y-4 pb-2">
								<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
									<CheckCircle2 className="h-8 w-8 text-green-500" />
								</div>
								<CardTitle className="text-2xl font-bold">
									Check your email
								</CardTitle>
								<CardDescription className="text-base">
									If an account exists for{" "}
									<span className="font-medium text-foreground">{email}</span>,
									you will receive a password reset link.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-2">
								<p className="text-sm text-muted-foreground">
									Click the link in your email to reset your password. Don&apos;t
									forget to check your spam folder.
								</p>
							</CardContent>
							<CardFooter className="flex flex-col space-y-4">
								<Button asChild className="w-full">
									<Link href="/signin">
										Back to Sign In
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button
									variant="ghost"
									className="w-full"
									onClick={() => {
										setSuccess(false);
										setEmail("");
									}}
								>
									Try a different email
								</Button>
							</CardFooter>
						</Card>
					</motion.div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen">
			<NavBar user={null} />
			<GridBackground />

			<div className="container relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					className="w-full max-w-md"
				>
					<Card className="border-border/50 bg-card/80 backdrop-blur">
						<CardHeader className="space-y-1">
							<div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
								<Mail className="h-6 w-6 text-primary" />
							</div>
							<CardTitle className="text-2xl font-bold text-center">
								Forgot Password?
							</CardTitle>
							<CardDescription className="text-center">
								No worries, we&apos;ll send you reset instructions.
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
											Sending...
										</>
									) : (
										<>
											Send Reset Link
											<ArrowRight className="ml-2 h-4 w-4" />
										</>
									)}
								</Button>
								<Button variant="ghost" asChild className="w-full">
									<Link href="/signin">
										<ArrowLeft className="mr-2 h-4 w-4" />
										Back to Sign In
									</Link>
								</Button>
							</CardFooter>
						</form>
					</Card>
				</motion.div>
			</div>
		</div>
	);
}

export default function ForgotPasswordPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<ForgotPasswordForm />
		</Suspense>
	);
}
