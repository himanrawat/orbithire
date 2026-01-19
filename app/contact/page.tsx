"use client";

import { useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { ArrowLeft, Mail, MessageSquare, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [subject, setSubject] = useState("");
	const [message, setMessage] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const res = await fetch("/api/contact", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, email, subject, message }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Failed to send message");
				return;
			}

			setSuccess(true);
			setName("");
			setEmail("");
			setSubject("");
			setMessage("");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="relative min-h-screen bg-background">
			<NavBar />

			<main className="container max-w-4xl py-12">
				<Link
					href="/"
					className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
				>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to home
				</Link>

				<h1 className="text-4xl font-bold tracking-tight mb-4">Contact Us</h1>
				<p className="text-lg text-muted-foreground mb-8">
					Have a question or feedback? We&apos;d love to hear from you.
				</p>

				<div className="grid gap-8 md:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<MessageSquare className="h-5 w-5" />
								Send us a message
							</CardTitle>
							<CardDescription>
								Fill out the form and we&apos;ll get back to you at{" "}
								<span className="font-medium text-foreground">info@himanshurawat.in</span>
							</CardDescription>
						</CardHeader>
						<CardContent>
							{success ? (
								<div className="flex flex-col items-center justify-center py-8 text-center">
									<CheckCircle className="h-12 w-12 text-green-500 mb-4" />
									<h3 className="text-lg font-semibold mb-2">Message Sent!</h3>
									<p className="text-muted-foreground mb-4">
										Thank you for reaching out. We&apos;ll get back to you soon.
									</p>
									<Button variant="outline" onClick={() => setSuccess(false)}>
										Send Another Message
									</Button>
								</div>
							) : (
								<form className="space-y-4" onSubmit={handleSubmit}>
									<div className="space-y-2">
										<Label htmlFor="name">Name</Label>
										<Input
											id="name"
											placeholder="Your name"
											value={name}
											onChange={(e) => setName(e.target.value)}
											required
											disabled={loading}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="email">Email</Label>
										<Input
											id="email"
											type="email"
											placeholder="your@email.com"
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											required
											disabled={loading}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="subject">Subject</Label>
										<Input
											id="subject"
											placeholder="How can we help?"
											value={subject}
											onChange={(e) => setSubject(e.target.value)}
											required
											disabled={loading}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="message">Message</Label>
										<Textarea
											id="message"
											placeholder="Tell us more about your question or feedback..."
											rows={5}
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											required
											disabled={loading}
										/>
									</div>
									{error && (
										<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
											{error}
										</div>
									)}
									<Button type="submit" className="w-full" disabled={loading}>
										{loading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Sending...
											</>
										) : (
											"Send Message"
										)}
									</Button>
								</form>
							)}
						</CardContent>
					</Card>

					<div className="space-y-6">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2">
									<Mail className="h-5 w-5" />
									Email Us Directly
								</CardTitle>
								<CardDescription>
									Prefer email? Reach out to us directly.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<a
									href="mailto:info@himanshurawat.in"
									className="text-primary hover:underline"
								>
									info@himanshurawat.in
								</a>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle>FAQs</CardTitle>
								<CardDescription>
									Common questions and answers
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-medium mb-1">How does the AI resume generation work?</h4>
									<p className="text-sm text-muted-foreground">
										Paste a job description and our AI analyzes it to create a tailored,
										ATS-optimized resume matching your profile to the role.
									</p>
								</div>
								<div>
									<h4 className="font-medium mb-1">Can I cancel my subscription?</h4>
									<p className="text-sm text-muted-foreground">
										Yes, you can cancel anytime from your account settings. Your access
										continues until the end of your billing period.
									</p>
								</div>
								<div>
									<h4 className="font-medium mb-1">Is my data secure?</h4>
									<p className="text-sm text-muted-foreground">
										Absolutely. We use industry-standard encryption and never share your
										personal information with third parties. See our{" "}
										<Link href="/privacy" className="text-primary hover:underline">
											Privacy Policy
										</Link>
										.
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
		</div>
	);
}
