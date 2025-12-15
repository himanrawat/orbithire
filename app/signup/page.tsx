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
import {
	Sparkles,
	ArrowRight,
	Loader2,
	CheckCircle2,
	RefreshCw,
	Camera,
	X,
} from "lucide-react";
import { sanitizeRedirect } from "@/lib/auth-utils";

const steps = [
	{
		number: "1",
		title: "Create your profile",
		description: "Add your experience, skills, and career goals once.",
	},
	{
		number: "2",
		title: "Paste a job description",
		description: "Our AI analyzes it and tailors your resume instantly.",
	},
	{
		number: "3",
		title: "Apply with confidence",
		description: "Get ATS-optimized resumes that land more interviews.",
	},
];

function SignUpForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [name, setName] = useState("");
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [avatar, setAvatar] = useState<string | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [resending, setResending] = useState(false);
	const [resendMessage, setResendMessage] = useState("");

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (file.size > 5 * 1024 * 1024) {
			setError("Image must be 5MB or smaller");
			return;
		}

		if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
			setError("Please use JPG, PNG, or WEBP images");
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const dataUrl = event.target?.result as string;
			setAvatar(dataUrl);
			setAvatarPreview(dataUrl);
		};
		reader.readAsDataURL(file);
	};

	const removeAvatar = () => {
		setAvatar(null);
		setAvatarPreview(null);
	};

	const signinHref = `/signin${
		searchParams.get("redirect")
			? `?redirect=${encodeURIComponent(searchParams.get("redirect")!)}`
			: ""
	}`;

	const handleResendConfirmation = async () => {
		setResending(true);
		setResendMessage("");

		try {
			const res = await fetch("/api/auth/resend-confirmation", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});

			const data = await res.json();

			if (!res.ok) {
				setResendMessage(data.error || "Failed to resend email");
				return;
			}

			setResendMessage("Confirmation email sent! Check your inbox.");
		} catch {
			setResendMessage("Something went wrong");
		} finally {
			setResending(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setNotice("");

		if (!name.trim()) {
			setError("Name is required");
			return;
		}

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
			const res = await fetch("/api/auth/signup", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email,
					password,
					name: name.trim(),
					phone: phone.trim() || null,
					avatar,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Signup failed");
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
									We sent a confirmation link to{" "}
									<span className="font-medium text-foreground">{email}</span>
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4 pt-2">
								<p className="text-sm text-muted-foreground">
									Click the link in your email to confirm your account, then
									sign in. Don&apos;t forget to check your spam folder.
								</p>
								{resendMessage && (
									<div
										className={`rounded-md p-3 text-sm ${
											resendMessage.includes("sent")
												? "bg-green-500/10 text-green-600 dark:text-green-400"
												: "bg-destructive/10 text-destructive"
										}`}
									>
										{resendMessage}
									</div>
								)}
							</CardContent>
							<CardFooter className="flex flex-col space-y-4">
								<Button asChild className="w-full">
									<Link href="/signin">
										Go to Sign In
										<ArrowRight className="ml-2 h-4 w-4" />
									</Link>
								</Button>
								<Button
									variant="ghost"
									className="w-full"
									onClick={handleResendConfirmation}
									disabled={resending}
								>
									{resending ? (
										<>
											<RefreshCw className="mr-2 h-4 w-4 animate-spin" />
											Sending...
										</>
									) : (
										<>
											<RefreshCw className="mr-2 h-4 w-4" />
											Resend confirmation email
										</>
									)}
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
									Get started with CVLeap AI for free
								</CardDescription>
							</CardHeader>
							<form onSubmit={handleSubmit}>
								<CardContent className="space-y-4">
									{/* Profile Photo */}
									<div className="flex flex-col items-center space-y-2">
										<div className="relative">
											{avatarPreview ? (
												<div className="relative">
													<img
														src={avatarPreview}
														alt="Profile preview"
														className="h-20 w-20 rounded-full object-cover border-2 border-border"
													/>
													<button
														type="button"
														onClick={removeAvatar}
														className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
													>
														<X className="h-3 w-3" />
													</button>
												</div>
											) : (
												<label
													htmlFor="avatar"
													className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/50 hover:bg-muted transition-colors"
												>
													<Camera className="h-6 w-6 text-muted-foreground" />
												</label>
											)}
											<input
												id="avatar"
												type="file"
												accept="image/jpeg,image/png,image/webp"
												onChange={handleAvatarChange}
												className="hidden"
												disabled={loading}
											/>
										</div>
										<span className="text-xs text-muted-foreground">
											Profile photo (optional)
										</span>
									</div>

									{/* Name */}
									<div className="space-y-2">
										<Label htmlFor="name">
											Full Name <span className="text-destructive">*</span>
										</Label>
										<Input
											id="name"
											type="text"
											placeholder="John Doe"
											value={name}
											onChange={(e) => setName(e.target.value)}
											required
											disabled={loading}
										/>
									</div>

									{/* Phone */}
									<div className="space-y-2">
										<Label htmlFor="phone">Phone Number</Label>
										<Input
											id="phone"
											type="tel"
											placeholder="+1 (555) 123-4567"
											value={phone}
											onChange={(e) => setPhone(e.target.value)}
											disabled={loading}
										/>
									</div>

									{/* Email */}
									<div className="space-y-2">
										<Label htmlFor="email">
											Email <span className="text-destructive">*</span>
										</Label>
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

									{/* Password */}
									<div className="space-y-2">
										<Label htmlFor="password">
											Password <span className="text-destructive">*</span>
										</Label>
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
									{/* Confirm Password */}
									<div className="space-y-2">
										<Label htmlFor="confirmPassword">
											Confirm Password{" "}
											<span className="text-destructive">*</span>
										</Label>
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
		<Suspense fallback={<div>Loading...</div>}>
			<SignUpForm />
		</Suspense>
	);
}
