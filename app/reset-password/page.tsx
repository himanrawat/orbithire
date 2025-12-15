"use client";

import { useState, useEffect, Suspense } from "react";
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
import { Lock, ArrowRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [sessionError, setSessionError] = useState(false);

	useEffect(() => {
		// Check if we have a valid session from the reset link
		const checkSession = async () => {
			const supabase = getSupabaseBrowserClient();
			const { data: { session } } = await supabase.auth.getSession();

			// If no session and no hash in URL, show error
			if (!session && !window.location.hash) {
				setSessionError(true);
			}
		};
		checkSession();
	}, []);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");

		if (password !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}

		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setLoading(true);

		try {
			const supabase = getSupabaseBrowserClient();

			const { error } = await supabase.auth.updateUser({
				password: password,
			});

			if (error) {
				setError(error.message);
				return;
			}

			setSuccess(true);
		} catch {
			setError("Something went wrong");
		} finally {
			setLoading(false);
		}
	};

	if (sessionError) {
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
								<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
									<AlertCircle className="h-8 w-8 text-destructive" />
								</div>
								<CardTitle className="text-2xl font-bold">
									Invalid or Expired Link
								</CardTitle>
								<CardDescription className="text-base">
									This password reset link is invalid or has expired.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-2">
								<p className="text-sm text-muted-foreground">
									Please request a new password reset link.
								</p>
							</CardContent>
							<CardFooter className="flex flex-col space-y-4">
								<Button asChild className="w-full">
									<Link href="/signin">
										Back to Sign In
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
							</CardFooter>
						</Card>
					</motion.div>
				</div>
			</div>
		);
	}

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
									Password Updated
								</CardTitle>
								<CardDescription className="text-base">
									Your password has been successfully reset.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-2">
								<p className="text-sm text-muted-foreground">
									You can now sign in with your new password.
								</p>
							</CardContent>
							<CardFooter className="flex flex-col space-y-4">
								<Button asChild className="w-full">
									<Link href="/signin">
										Sign In
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
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
								<Lock className="h-6 w-6 text-primary" />
							</div>
							<CardTitle className="text-2xl font-bold text-center">
								Reset Password
							</CardTitle>
							<CardDescription className="text-center">
								Enter your new password below
							</CardDescription>
						</CardHeader>
						<form onSubmit={handleSubmit}>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="password">New Password</Label>
									<Input
										id="password"
										type="password"
										placeholder="At least 8 characters"
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										required
										disabled={loading}
										minLength={8}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="confirmPassword">Confirm New Password</Label>
									<Input
										id="confirmPassword"
										type="password"
										placeholder="Confirm your password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
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
							</CardContent>
							<CardFooter className="flex flex-col space-y-4">
								<Button type="submit" className="w-full" disabled={loading}>
									{loading ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Updating...
										</>
									) : (
										<>
											Reset Password
											<ArrowRight className="ml-2 h-4 w-4" />
										</>
									)}
								</Button>
								<p className="text-center text-sm text-muted-foreground">
									Remember your password?{" "}
									<Link
										href="/signin"
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
	);
}

export default function ResetPasswordPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<ResetPasswordForm />
		</Suspense>
	);
}
