"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NavBar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { GridBackground } from "@/components/ui/aceternity";
import {
	Settings,
	Key,
	Globe,
	Cpu,
	CheckCircle2,
	AlertCircle,
	Loader2,
	ChevronRight,
	Sparkles,
	Zap,
	Server,
	Eye,
	EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Provider = "openai" | "groq" | "custom";
type ModelInfo = { id: string; owned_by?: string | null };

const providerConfig = {
	openai: {
		name: "OpenAI",
		description: "GPT-4, GPT-3.5 Turbo, and more",
		icon: Sparkles,
		color: "from-green-500 to-emerald-600",
	},
	groq: {
		name: "Groq",
		description: "Ultra-fast inference with LLaMA & Mixtral",
		icon: Zap,
		color: "from-orange-500 to-red-600",
	},
	custom: {
		name: "Custom",
		description: "Use your own OpenAI-compatible endpoint",
		icon: Server,
		color: "from-purple-500 to-indigo-600",
	},
};

export default function SettingsPage() {
	const [provider, setProvider] = useState<Provider>("openai");
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState("");
	const [models, setModels] = useState<ModelInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [showApiKey, setShowApiKey] = useState(false);

	async function fetchModels() {
		setLoading(true);
		setError(null);
		setSuccess(false);
		setModels([]);
		try {
			const res = await fetch("/api/llm/models", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider,
					apiKey: apiKey.trim() || undefined,
					baseUrl: baseUrl.trim() || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error || "Failed to fetch models");
			}
			setModels(data.models || []);
			setSuccess(true);
		} catch (err: any) {
			setError(err?.message || "Unable to fetch models");
		} finally {
			setLoading(false);
		}
	}

	const showBaseUrl = provider === "custom";
	const ProviderIcon = providerConfig[provider].icon;

	return (
		<div className="relative min-h-screen bg-background">
			<GridBackground />
			<NavBar />

			<main className="container relative z-10 mx-auto max-w-4xl px-4 py-8">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="mb-8"
				>
					<div className="flex items-center gap-3 mb-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
							<Settings className="h-5 w-5 text-primary" />
						</div>
						<h1 className="text-3xl font-bold">Settings</h1>
					</div>
					<p className="text-muted-foreground ml-13">
						Configure your AI provider and API keys for resume generation.
					</p>
				</motion.div>

				<div className="grid gap-6">
					{/* Provider Selection */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
					>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<Cpu className="h-5 w-5" />
									AI Provider
								</CardTitle>
								<CardDescription>
									Choose your preferred AI provider for generating resumes and
									cover letters.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid gap-3 sm:grid-cols-3">
									{(Object.keys(providerConfig) as Provider[]).map((p) => {
										const config = providerConfig[p];
										const Icon = config.icon;
										const isSelected = provider === p;
										return (
											<button
												key={p}
												onClick={() => setProvider(p)}
												className={cn(
													"relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50",
													isSelected
														? "border-primary bg-primary/5"
														: "border-border hover:bg-muted/50"
												)}
											>
												<div
													className={cn(
														"flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br text-white",
														config.color
													)}
												>
													<Icon className="h-5 w-5" />
												</div>
												<div>
													<p className="font-semibold">{config.name}</p>
													<p className="text-xs text-muted-foreground">
														{config.description}
													</p>
												</div>
												{isSelected && (
													<motion.div
														layoutId="provider-check"
														className="absolute right-3 top-3"
													>
														<CheckCircle2 className="h-5 w-5 text-primary" />
													</motion.div>
												)}
											</button>
										);
									})}
								</div>
							</CardContent>
						</Card>
					</motion.div>

					{/* API Configuration */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2 }}
					>
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-lg">
									<Key className="h-5 w-5" />
									API Configuration
								</CardTitle>
								<CardDescription>
									Enter your API key to connect to{" "}
									{providerConfig[provider].name}. Keys are not stored on our
									servers.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="apiKey">API Key</Label>
									<div className="relative">
										<Input
											id="apiKey"
											type={showApiKey ? "text" : "password"}
											placeholder="sk-... or leave blank to use server environment key"
											value={apiKey}
											onChange={(e) => setApiKey(e.target.value)}
											className="pr-10"
										/>
										<button
											type="button"
											onClick={() => setShowApiKey(!showApiKey)}
											className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{showApiKey ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
									<p className="text-xs text-muted-foreground">
										For testing, you can leave this blank to use the
										server&apos;s environment key.
									</p>
								</div>

								<AnimatePresence>
									{showBaseUrl && (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											className="space-y-2"
										>
											<Label htmlFor="baseUrl">Custom Base URL</Label>
											<div className="relative">
												<Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
												<Input
													id="baseUrl"
													type="text"
													placeholder="https://your-llm-endpoint/v1"
													value={baseUrl}
													onChange={(e) => setBaseUrl(e.target.value)}
													className="pl-10"
												/>
											</div>
										</motion.div>
									)}
								</AnimatePresence>

								<div className="flex items-center gap-3 pt-2">
									<Button onClick={fetchModels} disabled={loading}>
										{loading ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Connecting...
											</>
										) : (
											<>
												Test Connection
												<ChevronRight className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>

									<AnimatePresence>
										{error && (
											<motion.div
												initial={{ opacity: 0, x: -10 }}
												animate={{ opacity: 1, x: 0 }}
												exit={{ opacity: 0 }}
												className="flex items-center gap-2 text-sm text-destructive"
											>
												<AlertCircle className="h-4 w-4" />
												{error}
											</motion.div>
										)}
										{success && !error && (
											<motion.div
												initial={{ opacity: 0, x: -10 }}
												animate={{ opacity: 1, x: 0 }}
												exit={{ opacity: 0 }}
												className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
											>
												<CheckCircle2 className="h-4 w-4" />
												Connected successfully!
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							</CardContent>
						</Card>
					</motion.div>

					{/* Available Models */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.3 }}
					>
						<Card>
							<CardHeader>
								<div className="flex items-center justify-between">
									<div>
										<CardTitle className="flex items-center gap-2 text-lg">
											<Cpu className="h-5 w-5" />
											Available Models
										</CardTitle>
										<CardDescription>
											Models available from {providerConfig[provider].name}
										</CardDescription>
									</div>
									{models.length > 0 && (
										<span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
											{models.length} models
										</span>
									)}
								</div>
							</CardHeader>
							<CardContent>
								{models.length === 0 ? (
									<div className="flex flex-col items-center justify-center py-8 text-center">
										<div className="mb-3 rounded-full bg-muted p-3">
											<Cpu className="h-6 w-6 text-muted-foreground" />
										</div>
										<p className="text-sm text-muted-foreground">
											No models fetched yet. Click &quot;Test Connection&quot;
											to load available models.
										</p>
									</div>
								) : (
									<div className="grid gap-2 sm:grid-cols-2">
										{models.slice(0, 20).map((model, index) => (
											<motion.div
												key={model.id}
												initial={{ opacity: 0, y: 10 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ delay: index * 0.03 }}
												className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm"
											>
												<code className="truncate text-xs">{model.id}</code>
												{model.owned_by && (
													<span className="ml-2 shrink-0 text-xs text-muted-foreground">
														{model.owned_by}
													</span>
												)}
											</motion.div>
										))}
										{models.length > 20 && (
											<div className="col-span-full text-center text-sm text-muted-foreground">
												+{models.length - 20} more models
											</div>
										)}
									</div>
								)}
							</CardContent>
						</Card>
					</motion.div>
				</div>
			</main>
		</div>
	);
}
