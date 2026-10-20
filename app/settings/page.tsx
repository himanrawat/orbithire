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
	User,
	Shield,
	CreditCard,
	Link2,
	Lock,
	Smartphone,
	Mail,
	Trash2,
	Calendar,
	Receipt,
	Zap,
	ChevronLeft,
	Briefcase,
	Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProviderSelector } from "@/components/settings/ProviderSelector";
import { ModelDropdown } from "@/components/settings/ModelDropdown";
import { DeprecationWarning } from "@/components/settings/DeprecationWarning";
import { JobSearchSettings } from "@/components/jobs/JobSearchSettings";
import { RankingSettings } from "@/components/settings/RankingSettings";
import { AiConnections } from "@/components/settings/AiConnections";
import { ImportData } from "@/components/settings/ImportData";
import { Upload as ImportIcon } from "lucide-react";
import { getProviderModels, type ModelInfo } from "@/lib/ai/providers/registry";

type Provider = "openai" | "groq" | "anthropic" | "gemini" | "custom";
type Tab = "ai-provider" | "ai-connections" | "job-search" | "account" | "billing" | "integrations" | "import";

const tabs: {
	id: Tab;
	label: string;
	icon: React.ReactNode;
	disabled?: boolean;
}[] = [
	{
		id: "ai-provider",
		label: "AI Provider",
		icon: <Cpu className="h-4 w-4" />,
	},
	{
		id: "ai-connections",
		label: "AI connections",
		icon: <Plug className="h-4 w-4" />,
	},
	{
		id: "job-search",
		label: "Job search",
		icon: <Briefcase className="h-4 w-4" />,
	},
	{ id: "account", label: "Account", icon: <User className="h-4 w-4" /> },
	{ id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
	{
		id: "integrations",
		label: "Integrations",
		icon: <Link2 className="h-4 w-4" />,
	},
	{ id: "import", label: "Import", icon: <ImportIcon className="h-4 w-4" /> },
];

export default function SettingsPage() {
	const [activeTab, setActiveTab] = useState<Tab>("ai-provider");

	// Deep link: /settings?tab=job-search
	useEffect(() => {
		const tab = new URLSearchParams(window.location.search).get("tab");
		if (tab && tabs.some((t) => t.id === tab)) setActiveTab(tab as Tab);
	}, []);

	// AI Provider state
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
	const [removingKey, setRemovingKey] = useState(false);
	const [deprecationWarning, setDeprecationWarning] = useState<string | null>(
		null
	);
	const [wasAutoUpgraded, setWasAutoUpgraded] = useState(false);
	const [quota, setQuota] = useState<{
		used: number;
		limit: number;
		remaining: number;
		has_own_key: boolean;
	} | null>(null);

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
				setQuota(data.quota || null);

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

	async function removeApiKey() {
		setRemovingKey(true);
		setError(null);
		setSaveSuccess(false);
		setSuccess(false);
		try {
			const res = await fetch("/api/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider,
					apiKey: "",
					baseUrl: showBaseUrl ? baseUrl.trim() || undefined : undefined,
					defaultModel: selectedModel || undefined,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				throw new Error(data?.error || "Failed to remove API key");
			}

			setHasStoredKey(false);
			setApiKey("");
			setApiKeyPreview(null);
			setConnectionVerified(false);
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
			await loadSettings();
		} catch (err: unknown) {
			const message =
				err instanceof Error ? err.message : "Failed to remove API key";
			setError(message);
		} finally {
			setRemovingKey(false);
		}
	}

	return (
		<SidebarProvider>
			<SidebarLayout>
				{/* Top Bar for Mobile */}
				<header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
					<MobileMenuButton />
					<Link href="/" className="font-bold text-lg">
						CVLeap AI
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
							<Button variant="ghost" asChild className="mb-4">
								<Link href="/dashboard">
									<ChevronLeft className="mr-1 h-4 w-4" />
									Back to Dashboard
								</Link>
							</Button>
							<div className="flex items-center gap-3 mb-2">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<Settings className="h-5 w-5 text-primary" />
								</div>
								<h1 className="text-3xl font-bold">Settings</h1>
							</div>
							<p className="text-muted-foreground ml-13">
								Manage your account, AI providers, billing, and integrations.
							</p>
						</motion.div>

						{/* Tab Navigation */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1 }}
							className="mb-6"
						>
							<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/80 p-2 backdrop-blur">
								{tabs.map((tab) => (
									<button
										key={tab.id}
										onClick={() => !tab.disabled && setActiveTab(tab.id)}
										disabled={tab.disabled}
										className={cn(
											"flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
											activeTab === tab.id
												? "bg-primary text-primary-foreground"
												: tab.disabled
												? "cursor-not-allowed text-muted-foreground/50"
												: "text-muted-foreground hover:bg-muted hover:text-foreground"
										)}
									>
										{tab.icon}
										{tab.label}
										{tab.disabled && (
											<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
												Soon
											</span>
										)}
									</button>
								))}
							</div>
						</motion.div>

						{/* Deprecation Warning */}
						{deprecationWarning &&
							wasAutoUpgraded &&
							activeTab === "ai-provider" && (
								<DeprecationWarning
									message={deprecationWarning}
									onDismiss={() => {
										setDeprecationWarning(null);
										setWasAutoUpgraded(false);
									}}
								/>
							)}

						{/* Tab Content */}
						<motion.div
							key={activeTab}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2 }}
						>
							{activeTab === "ai-connections" && <AiConnections />}
							{activeTab === "import" && <ImportData />}

							{activeTab === "job-search" && (
								<div className="grid gap-6">
									<JobSearchSettings />
									<RankingSettings />
								</div>
							)}

							{/* AI Provider Tab */}
							{activeTab === "ai-provider" && (
								<div className="grid gap-6">
									{/* Free Generation Usage Card */}
									<Card
										className={cn(
											quota && !quota.has_own_key && quota.remaining === 0
												? "border-amber-500/50 bg-amber-500/5"
												: ""
										)}
									>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Zap className="h-5 w-5" />
												AI Generation Usage
												{quota?.has_own_key && (
													<span className="ml-auto flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
														<CheckCircle2 className="h-3 w-3" />
														Unlimited
													</span>
												)}
											</CardTitle>
											<CardDescription>
												{quota?.has_own_key
													? "You have your own API key configured - enjoy unlimited AI generations!"
													: "Track your free AI resume generations. Add your own API key for unlimited usage."}
											</CardDescription>
										</CardHeader>
										<CardContent>
											{loadingSettings ? (
												<div className="flex items-center justify-center py-4">
													<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
												</div>
											) : quota?.has_own_key ? (
												<div className="flex items-center gap-3 rounded-lg bg-green-500/5 border border-green-500/20 p-4">
													<div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
														<CheckCircle2 className="h-6 w-6 text-green-500" />
													</div>
													<div>
														<p className="font-medium text-green-600 dark:text-green-400">
															Unlimited Generations Active
														</p>
														<p className="text-sm text-muted-foreground">
															Your API key enables unlimited AI-powered resume
															and cover letter generation.
														</p>
													</div>
												</div>
											) : (
												<div className="space-y-4">
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-3">
															<div
																className={cn(
																	"flex h-12 w-12 items-center justify-center rounded-full",
																	quota?.remaining === 0
																		? "bg-amber-500/10"
																		: "bg-purple-500/10"
																)}
															>
																<Zap
																	className={cn(
																		"h-6 w-6",
																		quota?.remaining === 0
																			? "text-amber-500"
																			: "text-purple-500"
																	)}
																/>
															</div>
															<div>
																<p className="text-2xl font-bold">
																	{quota?.used ?? 0}{" "}
																	<span className="text-lg text-muted-foreground font-normal">
																		/ {quota?.limit ?? 2}
																	</span>
																</p>
																<p className="text-sm text-muted-foreground">
																	Free generations used
																</p>
															</div>
														</div>
														<div className="text-right">
															<p
																className={cn(
																	"text-lg font-semibold",
																	quota?.remaining === 0
																		? "text-amber-600 dark:text-amber-400"
																		: "text-purple-600 dark:text-purple-400"
																)}
															>
																{quota?.remaining ?? 2} remaining
															</p>
														</div>
													</div>
													{/* Progress bar */}
													<div className="h-2 w-full rounded-full bg-muted overflow-hidden">
														<div
															className={cn(
																"h-full rounded-full transition-all duration-500",
																quota?.remaining === 0
																	? "bg-amber-500"
																	: "bg-purple-500"
															)}
															style={{
																width: `${Math.min(
																	100,
																	((quota?.used ?? 0) / (quota?.limit ?? 2)) *
																		100
																)}%`,
															}}
														/>
													</div>
													{quota?.remaining === 0 && (
														<div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm">
															<AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
															<p className="text-amber-700 dark:text-amber-300">
																You&apos;ve used all free generations. Add your
																own API key below to continue generating
																resumes.
															</p>
														</div>
													)}
												</div>
											)}
										</CardContent>
									</Card>

									{/* Provider Selection */}
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

									{/* API Configuration */}
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

														<Button
															onClick={removeApiKey}
															disabled={removingKey || !hasStoredKey || saving}
															variant="destructive"
														>
															{removingKey ? (
																<>
																	<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																	Removing...
																</>
															) : (
																<>
																	<Trash2 className="mr-2 h-4 w-4" />
																	Remove API Key
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
								</div>
							)}

							{/* Account Tab */}
							{activeTab === "account" && (
								<div className="grid gap-6">
									{/* Security */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Shield className="h-5 w-5" />
												Security
											</CardTitle>
											<CardDescription>
												Manage your password and authentication settings.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											{/* Reset Password */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
														<Lock className="h-5 w-5 text-muted-foreground" />
													</div>
													<div>
														<p className="font-medium">Password</p>
														<p className="text-sm text-muted-foreground">
															Change your account password
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm">
													Reset Password
												</Button>
											</div>

											{/* MFA */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
														<Smartphone className="h-5 w-5 text-muted-foreground" />
													</div>
													<div>
														<p className="font-medium">
															Two-Factor Authentication
														</p>
														<p className="text-sm text-muted-foreground">
															Add an extra layer of security to your account
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Enable</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>

									{/* Email Preferences */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Mail className="h-5 w-5" />
												Email Preferences
											</CardTitle>
											<CardDescription>
												Manage your email and notification settings.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
														<Mail className="h-5 w-5 text-muted-foreground" />
													</div>
													<div>
														<p className="font-medium">Email Notifications</p>
														<p className="text-sm text-muted-foreground">
															Receive updates about your applications and
															resumes
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Configure</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>

									{/* Danger Zone */}
									<Card className="border-destructive/50">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg text-destructive">
												<Trash2 className="h-5 w-5" />
												Danger Zone
											</CardTitle>
											<CardDescription>
												Irreversible actions that affect your account.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
												<div>
													<p className="font-medium">Delete Account</p>
													<p className="text-sm text-muted-foreground">
														Permanently delete your account and all associated
														data
													</p>
												</div>
												<Button variant="destructive" size="sm" disabled>
													<span className="mr-2">Delete</span>
													<span className="rounded bg-destructive-foreground/20 px-1.5 py-0.5 text-[10px] font-medium">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>
								</div>
							)}

							{/* Billing Tab */}
							{activeTab === "billing" && (
								<div className="grid gap-6">
									{/* Current Plan */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Zap className="h-5 w-5" />
												Current Plan
												<span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
													Soon
												</span>
											</CardTitle>
											<CardDescription>
												Manage your subscription and plan details.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="rounded-lg border p-4">
												<div className="flex items-center justify-between">
													<div>
														<p className="text-lg font-semibold">Free Plan</p>
														<p className="text-sm text-muted-foreground">
															Basic features for getting started
														</p>
													</div>
													<Button disabled>
														<span className="mr-2">Upgrade</span>
														<span className="rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-medium">
															Soon
														</span>
													</Button>
												</div>
											</div>
										</CardContent>
									</Card>

									{/* Payment Method */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<CreditCard className="h-5 w-5" />
												Payment Method
												<span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
													Soon
												</span>
											</CardTitle>
											<CardDescription>
												Manage your payment details.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="rounded-lg border border-dashed p-6 text-center">
												<CreditCard className="mx-auto h-8 w-8 text-muted-foreground" />
												<p className="mt-2 text-sm text-muted-foreground">
													No payment method added
												</p>
												<Button
													variant="outline"
													size="sm"
													className="mt-3"
													disabled
												>
													<span className="mr-2">Add Payment Method</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>

									{/* Billing History */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Receipt className="h-5 w-5" />
												Billing History
												<span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
													Soon
												</span>
											</CardTitle>
											<CardDescription>
												View your past invoices and payments.
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="rounded-lg border border-dashed p-6 text-center">
												<Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
												<p className="mt-2 text-sm text-muted-foreground">
													No billing history
												</p>
											</div>
										</CardContent>
									</Card>
								</div>
							)}

							{/* Integrations Tab */}
							{activeTab === "integrations" && (
								<div className="grid gap-6">
									{/* Email Integrations */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Mail className="h-5 w-5" />
												Email Integrations
											</CardTitle>
											<CardDescription>
												Connect your email accounts to track job applications.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											{/* Gmail */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
														<img
															src="/gmail.svg"
															alt="Gmail"
															className="h-6 w-6"
														/>
													</div>
													<div>
														<p className="font-medium">Gmail</p>
														<p className="text-sm text-muted-foreground">
															Connect your Gmail account
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Connect</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>

											{/* Outlook */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
														<img
															src="/outlook.svg"
															alt="Outlook"
															className="h-6 w-6"
														/>
													</div>
													<div>
														<p className="font-medium">Outlook</p>
														<p className="text-sm text-muted-foreground">
															Connect your Outlook account
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Connect</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>

									{/* Calendar Integrations */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Calendar className="h-5 w-5" />
												Calendar Integrations
											</CardTitle>
											<CardDescription>
												Sync your calendar to manage interview schedules.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											{/* Google Calendar */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
														<img
															src="/g-calendar.svg"
															alt="Google Calendar"
															className="h-6 w-6"
														/>
													</div>
													<div>
														<p className="font-medium">Google Calendar</p>
														<p className="text-sm text-muted-foreground">
															Sync with Google Calendar
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Connect</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>

											{/* Outlook Calendar */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10">
														<img
															src="/outlook-calendar.svg"
															alt="Outlook Calendar"
															className="h-6 w-6"
														/>
													</div>
													<div>
														<p className="font-medium">Outlook Calendar</p>
														<p className="text-sm text-muted-foreground">
															Sync with Outlook Calendar
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Connect</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>

									{/* Professional Networks */}
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-lg">
												<Link2 className="h-5 w-5" />
												Professional Networks
											</CardTitle>
											<CardDescription>
												Import your profile from professional networks.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											{/* LinkedIn */}
											<div className="flex items-center justify-between rounded-lg border p-4">
												<div className="flex items-center gap-3">
													<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2]/10">
														<svg
															className="h-5 w-5"
															viewBox="0 0 24 24"
															fill="#0A66C2"
														>
															<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
														</svg>
													</div>
													<div>
														<p className="font-medium">LinkedIn</p>
														<p className="text-sm text-muted-foreground">
															Import your LinkedIn profile
														</p>
													</div>
												</div>
												<Button variant="outline" size="sm" disabled>
													<span className="mr-2">Connect</span>
													<span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
														Soon
													</span>
												</Button>
											</div>
										</CardContent>
									</Card>
								</div>
							)}
						</motion.div>
					</main>
				</div>
			</SidebarLayout>
		</SidebarProvider>
	);
}
