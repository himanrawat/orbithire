"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
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
import { Shield, ArrowRight, Loader2 } from "lucide-react";

function AdminSignUpForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [accessCode, setAccessCode] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

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
			const res = await fetch("/api/auth/admin/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, email, password, accessCode }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Sign up failed");
				return;
			}

			router.push("/admin/signin?registered=true");
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
									<Shield className="h-6 w-6 text-primary" />
								</div>
								<h2 className="text-3xl font-bold tracking-tight">
									Request Admin Access
								</h2>
								<p className="mt-2 text-muted-foreground">
									Create an admin account to manage the CVLeap platform.
									An access code is required for registration.
								</p>
							</div>
							<div className="space-y-4">
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.3, delay: 0.2 }}
									className="flex gap-4"
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
										<Shield className="h-4 w-4 text-primary" />
									</div>
									<div>
										<h3 className="font-medium">Access Code Required</h3>
										<p className="text-sm text-muted-foreground">
											Contact the system administrator for an access code.
										</p>
									</div>
								</motion.div>
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.3, delay: 0.3 }}
									className="flex gap-4"
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
										<Shield className="h-4 w-4 text-primary" />
									</div>
									<div>
										<h3 className="font-medium">Verified Administrators</h3>
										<p className="text-sm text-muted-foreground">
											Only authorized personnel can access admin features.
										</p>
									</div>
								</motion.div>
								<motion.div
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.3, delay: 0.4 }}
									className="flex gap-4"
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background">
										<Shield className="h-4 w-4 text-primary" />
									</div>
									<div>
										<h3 className="font-medium">Full Platform Control</h3>
										<p className="text-sm text-muted-foreground">
											Manage users, content, and platform settings.
										</p>
									</div>
								</motion.div>
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
								<CardTitle className="text-2xl font-bold">Admin Sign Up</CardTitle>
								<CardDescription>
									Create your admin account with an access code
								</CardDescription>
							</CardHeader>
							<form onSubmit={handleSubmit}>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="name">Full Name</Label>
										<Input
											id="name"
											type="text"
											placeholder="John Doe"
											value={name}
											onChange={(e) => setName(e.target.value)}
											required
											disabled={loading}
											autoComplete="name"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="admin@example.com"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											required
											disabled={loading}
											autoComplete="email"
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
											autoComplete="new-password"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="confirmPassword">Confirm Password</Label>
										<Input
											id="confirmPassword"
											type="password"
											placeholder="••••••••"
											value={confirmPassword}
											onChange={(e) => setConfirmPassword(e.target.value)}
											required
											disabled={loading}
											autoComplete="new-password"
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="accessCode">Access Code</Label>
										<Input
											id="accessCode"
											type="text"
											placeholder="Enter your access code"
											value={accessCode}
											onChange={(e) => setAccessCode(e.target.value)}
											required
											disabled={loading}
											autoComplete="off"
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
												Creating account...
											</>
										) : (
											<>
												Create Admin Account
												<ArrowRight className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>
									<p className="text-center text-sm text-muted-foreground">
										Already have an admin account?{" "}
										<Link
											href="/admin/signin"
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

export default function AdminSignUpPage() {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<AdminSignUpForm />
		</Suspense>
	);
}
