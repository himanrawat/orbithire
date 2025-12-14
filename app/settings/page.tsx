"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
	SidebarProvider,
	SidebarLayout,
	MobileMenuButton,
} from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
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
	Eye,
	EyeOff,
	Save,
	RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderSelector } from "@/components/settings/ProviderSelector";
import { ModelDropdown } from "@/components/settings/ModelDropdown";
import { DeprecationWarning } from "@/components/settings/DeprecationWarning";
import { getProviderModels, type ModelInfo } from "@/lib/ai/providers/registry";

type Provider = "openai" | "groq" | "anthropic" | "gemini" | "custom";

export default function SettingsPage() {
	const [provider, setProvider] = useState<Provider>("groq");
	const [apiKey, setApiKey] = useState("");
	const [apiKeyPreview, setApiKeyPreview] = useState<string | null>(null);
	const [baseUrl, setBaseUrl] = useState("");
	const [selectedModel, setSelectedModel] = useState("");
	const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [loadingSettings, setLoadingSettings] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);
	const [saveSuccess, setSaveSuccess] = useState(false);
	const [showApiKey, setShowApiKey] = useState(false);
	const [hasStoredKey, setHasStoredKey] = useState(false);
	const [connectionVerified, setConnectionVerified] = useState(false);
	const [deprecationWarning, setDeprecationWarning] = useState<string | null>(null);
	const [wasAutoUpgraded, setWasAutoUpgraded] = useState(false);

	// Load saved settings on mount
	const loadSettings = useCallback(async () => {
		setLoadingSettings(true);
		try {
			const res = await fetch("/api/settings");
			if (res.ok) {
				const data = await res.json();
				setProvider(data.provider || "groq");
				setHasStoredKey(data.hasApiKey || false);
				setApiKeyPreview(data.apiKeyPreview || null);
				setBaseUrl(data.baseUrl || "");
				setSelectedModel(data.defaultModel || "");
				setConnectionVerified(data.connectionVerified || false);
				setDeprecationWarning(data.deprecationWarning || null);
				setWasAutoUpgraded(data.wasAutoUpgraded || false);

				// Load available models from registry for this provider
				const models = getProviderModels(data.provider || "groq");
				setAvailableModels(models);
			}
		} catch (err) {
			console.error("Failed to load settings:", err);
		} finally {
			setLoadingSettings(false);
		}
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	// Save settings to database
	async function saveSettings() {
		setSaving(true);
		setError(null);
		setSaveSuccess(false);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider,
					apiKey: apiKey.trim() || undefined,
					baseUrl: baseUrl.trim() || undefined,
					defaultModel: selectedModel || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error || "Failed to save settings");
			}
			setHasStoredKey(data.hasApiKey);
			setApiKey(""); // Clear the input after saving
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
			// Reload settings to get any auto-upgrades
			await loadSettings();
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Failed to save";
			setError(message);
		} finally {
			setSaving(false);
		}
	}

	async function testConnection() {
		setLoading(true);
		setError(null);
		setSuccess(false);
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
				throw new Error(data?.error || "Failed to connect to provider");
			}
			setAvailableModels(data.models || []);
			setSuccess(true);

			// Update verification status
			await fetch("/api/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verified: true }),
			});
			setConnectionVerified(true);
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Unable to connect to provider";
			setError(message);
			// Update verification status on failure
			await fetch("/api/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ verified: false }),
			});
			setConnectionVerified(false);
		} finally {
			setLoading(false);
		}
	}

	// Update available models when provider changes
	useEffect(() => {
		const models = getProviderModels(provider);
		setAvailableModels(models);
		// Clear selected model if it doesn't exist in new provider
		if (selectedModel && !models.find((m) => m.id === selectedModel)) {
			setSelectedModel("");
		}
	}, [provider, selectedModel]);

	const showBaseUrl = provider === "custom";

	return (
		<SidebarProvider>
			<SidebarLayout>
				{/* Top Bar for Mobile */}
				<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
					<MobileMenuButton />
					<Link href="/" className="font-bold text-lg">
						OrbitHire
					</Link>
					<div className="flex items-center gap-2">
						<ThemeToggle />
					</div>
				</header>

				<div className="relative min-h-screen bg-background">
					<GridBackground />

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

						{/* Deprecation Warning */}
						{deprecationWarning && wasAutoUpgraded && (
							<DeprecationWarning
								message={deprecationWarning}
								onDismiss={() => {
									setDeprecationWarning(null);
									setWasAutoUpgraded(false);
								}}
							/>
						)}

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
											Choose your preferred AI provider for generating resumes
											and cover letters.
										</CardDescription>
									</CardHeader>
									<CardContent>
										<ProviderSelector
											value={provider}
											onChange={(p) => setProvider(p as Provider)}
											disabled={loading || saving}
										/>
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
											{hasStoredKey && (
												<span className="ml-auto flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
													<CheckCircle2 className="h-3 w-3" />
													Key Saved
												</span>
											)}
										</CardTitle>
										<CardDescription>
											Enter your API key for{" "}
											{provider === "openai"
												? "OpenAI"
												: provider === "groq"
												? "Groq"
												: provider === "anthropic"
												? "Anthropic"
												: provider === "gemini"
												? "Google Gemini"
												: "your provider"}
											. Your key is securely stored and used for AI resume
											generation.
											{apiKeyPreview && hasStoredKey && (
												<span className="ml-1 font-mono text-xs">
													(Current: {apiKeyPreview})
												</span>
											)}
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{loadingSettings ? (
											<div className="flex items-center justify-center py-4">
												<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
											</div>
										) : (
											<>
												<div className="space-y-2">
													<Label htmlFor="apiKey">
														{hasStoredKey ? "Update API Key" : "API Key"}
													</Label>
													<div className="relative">
														<Input
															id="apiKey"
															type={showApiKey ? "text" : "password"}
															placeholder={
																hasStoredKey
																	? "Enter new key to update..."
																	: "sk-... your API key"
															}
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
														{hasStoredKey
															? "Your API key is saved. Enter a new key to update it."
															: "Enter your API key. It will be securely stored for AI generation."}
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

												{/* Model Selection */}
												<div className="space-y-2">
													<ModelDropdown
														models={availableModels}
														value={selectedModel}
														onChange={setSelectedModel}
														disabled={loading || saving}
													/>
												</div>

												<div className="flex flex-wrap items-center gap-3 pt-2">
													<Button
														onClick={saveSettings}
														disabled={
															saving || (!apiKey.trim() && !selectedModel)
														}
														variant="default"
													>
														{saving ? (
															<>
																<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																Saving...
															</>
														) : (
															<>
																<Save className="mr-2 h-4 w-4" />
																Save Settings
															</>
														)}
													</Button>

													<Button
														onClick={testConnection}
														disabled={loading || !apiKey.trim()}
														variant="outline"
													>
														{loading ? (
															<>
																<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																Testing...
															</>
														) : (
															<>
																<RefreshCw className="mr-2 h-4 w-4" />
																Test Connection
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
														{saveSuccess && !error && (
															<motion.div
																initial={{ opacity: 0, x: -10 }}
																animate={{ opacity: 1, x: 0 }}
																exit={{ opacity: 0 }}
																className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
															>
																<CheckCircle2 className="h-4 w-4" />
																Settings saved!
															</motion.div>
														)}
														{success && !error && !saveSuccess && (
															<motion.div
																initial={{ opacity: 0, x: -10 }}
																animate={{ opacity: 1, x: 0 }}
																exit={{ opacity: 0 }}
																className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400"
															>
																<CheckCircle2 className="h-4 w-4" />
																Connection verified!
															</motion.div>
														)}
													</AnimatePresence>
												</div>
											</>
										)}
									</CardContent>
								</Card>
							</motion.div>
						</div>
					</main>
				</div>
			</SidebarLayout>
		</SidebarProvider>
	);
}
