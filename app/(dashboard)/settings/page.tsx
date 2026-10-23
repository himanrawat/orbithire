"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
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
	Briefcase,
	Plug,
	Upload as ImportIcon,
	ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { tabClass, tabListClass } from "@/components/app/blocks";
import { ProviderSelector } from "@/components/settings/ProviderSelector";
import { ModelDropdown } from "@/components/settings/ModelDropdown";
import { DeprecationWarning } from "@/components/settings/DeprecationWarning";
import { JobSearchSettings } from "@/components/jobs/JobSearchSettings";
import { RankingSettings } from "@/components/settings/RankingSettings";
import { AiConnections } from "@/components/settings/AiConnections";
import { ImportData } from "@/components/settings/ImportData";
import { PrivacyChoices } from "@/components/settings/PrivacyChoices";
import { DataAndAccount } from "@/components/settings/DataAndAccount";
import { PublicProfileSettings } from "@/components/milestones/PublicProfileSettings";
import { CareerStageSettings } from "@/components/settings/CareerStageSettings";
import { GoogleCalendarCard } from "@/components/settings/GoogleCalendarCard";
import { getProviderModels, type ModelInfo } from "@/lib/ai/providers/registry";

type Provider = "openai" | "groq" | "anthropic" | "gemini" | "custom";
type Tab =
	| "ai-provider"
	| "ai-connections"
	| "job-search"
	| "account"
	| "billing"
	| "integrations"
	| "import"
	| "privacy";

const PROVIDER_LABELS: Record<Provider, string> = {
	openai: "OpenAI",
	groq: "Groq",
	anthropic: "Anthropic",
	gemini: "Google Gemini",
	custom: "your provider",
};

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
	{
		id: "privacy",
		label: "Data & privacy",
		icon: <ShieldCheck className="h-4 w-4" />,
	},
];

async function updateVerification(verified: boolean) {
	await fetch("/api/settings", {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ verified }),
	});
}

function Show({
	when,
	children,
}: Readonly<{ when: boolean; children: React.ReactNode }>) {
	return when ? <>{children}</> : null;
}

function choose<T>(condition: boolean, whenTrue: T, whenFalse: T) {
	return condition ? whenTrue : whenFalse;
}

function all(...conditions: boolean[]) {
	return conditions.every(Boolean);
}

function any(...conditions: boolean[]) {
	return conditions.some(Boolean);
}

function getDisabledTabClass(disabled?: boolean) {
	return disabled
		? "cursor-not-allowed opacity-50 hover:text-muted-foreground"
		: undefined;
}

function shouldShowDeprecationWarning(
	warning: string | null,
	wasAutoUpgraded: boolean,
	activeTab: Tab
) {
	return warning !== null && wasAutoUpgraded && activeTab === "ai-provider";
}

function useActiveSettingsTab() {
	const [activeTab, setActiveTab] = useState<Tab>("ai-provider");
	useEffect(() => {
		const tab = new URLSearchParams(window.location.search).get("tab");
		if (tab && tabs.some((item) => item.id === tab)) setActiveTab(tab as Tab);
	}, []);
	return [activeTab, setActiveTab] as const;
}

function useProviderSettings() {
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

	const loadSettings = useCallback(async () => {
		setLoadingSettings(true);
		try {
			const res = await fetch("/api/settings");
			if (!res.ok) return;
			const data = await res.json();
			const savedProvider = data.provider || "groq";
			setProvider(savedProvider);
			setHasStoredKey(data.hasApiKey || false);
			setApiKeyPreview(data.apiKeyPreview || null);
			setBaseUrl(data.baseUrl || "");
			setSelectedModel(data.defaultModel || "");
			setDeprecationWarning(data.deprecationWarning || null);
			setWasAutoUpgraded(data.wasAutoUpgraded || false);
			setQuota(data.quota || null);
			setAvailableModels(getProviderModels(savedProvider));
		} catch (loadError) {
			console.error("Failed to load settings:", loadError);
		} finally {
			setLoadingSettings(false);
		}
	}, []);

	useEffect(() => {
		void loadSettings();
	}, [loadSettings]);

	useEffect(() => {
		const models = getProviderModels(provider);
		setAvailableModels(models);
		if (selectedModel && !models.some((model) => model.id === selectedModel))
			setSelectedModel("");
	}, [provider, selectedModel]);

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
			if (!res.ok) throw new Error(data?.error || "Failed to save settings");
			setHasStoredKey(data.hasApiKey);
			setApiKey("");
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
			await loadSettings();
		} catch (saveError: unknown) {
			setError(
				saveError instanceof Error ? saveError.message : "Failed to save"
			);
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
			if (!res.ok)
				throw new Error(data?.error || "Failed to connect to provider");
			setAvailableModels(data.models || []);
			setSuccess(true);
			await updateVerification(true);
		} catch (connectionError: unknown) {
			setError(
				connectionError instanceof Error
					? connectionError.message
					: "Unable to connect to provider"
			);
			await updateVerification(false);
		} finally {
			setLoading(false);
		}
	}

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
			if (!res.ok) throw new Error(data?.error || "Failed to remove API key");
			setHasStoredKey(false);
			setApiKey("");
			setApiKeyPreview(null);
			setSaveSuccess(true);
			setTimeout(() => setSaveSuccess(false), 3000);
			await loadSettings();
		} catch (removeError: unknown) {
			setError(
				removeError instanceof Error
					? removeError.message
					: "Failed to remove API key"
			);
		} finally {
			setRemovingKey(false);
		}
	}

	return {
		provider,
		setProvider,
		apiKey,
		setApiKey,
		apiKeyPreview,
		baseUrl,
		setBaseUrl,
		selectedModel,
		setSelectedModel,
		availableModels,
		loading,
		saving,
		loadingSettings,
		error,
		success,
		saveSuccess,
		showApiKey,
		setShowApiKey,
		hasStoredKey,
		removingKey,
		deprecationWarning,
		setDeprecationWarning,
		wasAutoUpgraded,
		setWasAutoUpgraded,
		quota,
		showBaseUrl,
		saveSettings,
		testConnection,
		removeApiKey,
	};
}

export default function SettingsPage() {
	const [activeTab, setActiveTab] = useActiveSettingsTab();
	const {
		provider,
		setProvider,
		apiKey,
		setApiKey,
		apiKeyPreview,
		baseUrl,
		setBaseUrl,
		selectedModel,
		setSelectedModel,
		availableModels,
		loading,
		saving,
		loadingSettings,
		error,
		success,
		saveSuccess,
		showApiKey,
		setShowApiKey,
		hasStoredKey,
		removingKey,
		deprecationWarning,
		setDeprecationWarning,
		wasAutoUpgraded,
		setWasAutoUpgraded,
		quota,
		showBaseUrl,
		saveSettings,
		testConnection,
		removeApiKey,
	} = useProviderSettings();

	return (
		<div className="relative min-h-screen">
			<div className="relative mx-auto max-w-4xl px-4 py-8 md:px-8">
				<PageHeader
					icon={<Settings />}
					title="Settings"
					description="Your account, AI providers, job search, connected apps and imports."
				/>

				{/* Tab Navigation */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.1 }}
					className="mb-6"
				>
					<div
						role="tablist"
						aria-label="Settings sections"
						className={tabListClass}
					>
						{tabs.map((tab) => (
							<button
								key={tab.id}
								role="tab"
								aria-selected={activeTab === tab.id}
								onClick={() => setActiveTab(tab.id)}
								disabled={tab.disabled}
								className={cn(
									tabClass(activeTab === tab.id),
									"[&_svg]:h-4 [&_svg]:w-4",
									getDisabledTabClass(tab.disabled)
								)}
							>
								{tab.icon}
								{tab.label}
								<Show when={Boolean(tab.disabled)}>
									<span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
										Soon
									</span>
								</Show>
							</button>
						))}
					</div>
				</motion.div>

				{/* Deprecation Warning */}
				<Show
					when={shouldShowDeprecationWarning(
						deprecationWarning,
						wasAutoUpgraded,
						activeTab
					)}
				>
					<DeprecationWarning
						message={deprecationWarning ?? ""}
						onDismiss={() => {
							setDeprecationWarning(null);
							setWasAutoUpgraded(false);
						}}
					/>
				</Show>

				{/* Tab Content */}
				<motion.div
					key={activeTab}
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.2 }}
				>
					<Show when={activeTab === "ai-connections"}>
						<AiConnections />
					</Show>
					<Show when={activeTab === "import"}>
						<ImportData />
					</Show>
					<Show when={activeTab === "privacy"}>
						<div className="grid gap-6">
							<PrivacyChoices />
							<PublicProfileSettings />
							<DataAndAccount />
						</div>
					</Show>

					<Show when={activeTab === "job-search"}>
						<div className="grid gap-6">
							<JobSearchSettings />
							<RankingSettings />
						</div>
					</Show>

					{/* AI Provider Tab */}
					<Show when={activeTab === "ai-provider"}>
						<div className="grid gap-6">
							{/* Free Generation Usage Card */}
							<Card
								className={cn(
									choose(
										all(
											Boolean(quota),
											!quota?.has_own_key,
											quota?.remaining === 0
										),
										"border-[color-mix(in_srgb,var(--cap)_40%,transparent)] bg-[var(--cap-soft)]",
										""
									)
								)}
							>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Zap className="h-5 w-5" />
										AI Generation Usage
										<Show when={Boolean(quota?.has_own_key)}>
											<span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
												<CheckCircle2 className="h-3 w-3" />
												Unlimited
											</span>
										</Show>
									</CardTitle>
									<CardDescription>
										{choose(
											Boolean(quota?.has_own_key),
											"You have your own API key configured - enjoy unlimited AI generations!",
											"Track your free AI resume generations. Add your own API key for unlimited usage."
										)}
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Show when={loadingSettings}>
										<div className="flex items-center justify-center py-4">
											<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
										</div>
									</Show>
									<Show
										when={all(!loadingSettings, Boolean(quota?.has_own_key))}
									>
										<div className="flex items-center gap-3 rounded-lg bg-[var(--success-soft)] border border-[color-mix(in_srgb,var(--success)_40%,transparent)] p-4">
											<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--success-soft)]">
												<CheckCircle2 className="h-6 w-6 text-[var(--success)]" />
											</div>
											<div>
												<p className="font-medium text-[var(--success)]">
													Unlimited Generations Active
												</p>
												<p className="text-sm text-muted-foreground">
													Your API key enables unlimited AI-powered resume and
													cover letter generation.
												</p>
											</div>
										</div>
									</Show>
									<Show when={all(!loadingSettings, !quota?.has_own_key)}>
										<div className="space-y-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div
														className={cn(
															"flex h-12 w-12 items-center justify-center rounded-full",
															choose(
																quota?.remaining === 0,
																"bg-[var(--cap-soft)]",
																"bg-[var(--kind-prep-soft)]"
															)
														)}
													>
														<Zap
															className={cn(
																"h-6 w-6",
																choose(
																	quota?.remaining === 0,
																	"text-[var(--cap-ink)]",
																	"text-[var(--kind-prep)]"
																)
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
															choose(
																quota?.remaining === 0,
																"text-[var(--cap-ink)]",
																"text-[var(--kind-prep)]"
															)
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
														choose(
															quota?.remaining === 0,
															"bg-[var(--cap)]",
															"bg-[var(--kind-prep)]"
														)
													)}
													style={{
														width: `${Math.min(
															100,
															((quota?.used ?? 0) / (quota?.limit ?? 2)) * 100
														)}%`,
													}}
												/>
											</div>
											<Show when={quota?.remaining === 0}>
												<div className="flex items-center gap-2 rounded-lg bg-[var(--cap-soft)] border border-[color-mix(in_srgb,var(--cap)_40%,transparent)] p-3 text-sm">
													<AlertCircle className="h-4 w-4 text-[var(--cap-ink)] shrink-0" />
													<p className="text-[var(--cap-ink)]">
														You&apos;ve used all free generations. Add your own
														API key below to continue generating resumes.
													</p>
												</div>
											</Show>
										</div>
									</Show>
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
										Choose your preferred AI provider for generating resumes and
										cover letters.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<ProviderSelector
										value={provider}
										onChange={(p) => setProvider(p as Provider)}
										disabled={any(loading, saving)}
									/>
								</CardContent>
							</Card>

							{/* API Configuration */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Key className="h-5 w-5" />
										API Configuration
										<Show when={hasStoredKey}>
											<span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
												<CheckCircle2 className="h-3 w-3" />
												Key Saved
											</span>
										</Show>
									</CardTitle>
									<CardDescription>
										Enter your API key for {PROVIDER_LABELS[provider]}. Your key
										is securely stored and used for AI resume generation.
										<Show when={all(Boolean(apiKeyPreview), hasStoredKey)}>
											<span className="ml-1 font-mono text-xs">
												(Current: {apiKeyPreview})
											</span>
										</Show>
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<Show when={loadingSettings}>
										<div className="flex items-center justify-center py-4">
											<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
										</div>
									</Show>
									<Show when={!loadingSettings}>
										<>
											<div className="space-y-2">
												<Label htmlFor="apiKey">
													{choose(hasStoredKey, "Update API Key", "API Key")}
												</Label>
												<div className="relative">
													<Input
														id="apiKey"
														type={choose(showApiKey, "text", "password")}
														placeholder={choose(
															hasStoredKey,
															"Enter new key to update...",
															"sk-... your API key"
														)}
														value={apiKey}
														onChange={(e) => setApiKey(e.target.value)}
														className="pr-12"
													/>
													<button
														type="button"
														onClick={() => setShowApiKey(!showApiKey)}
														aria-label={choose(
															showApiKey,
															"Hide API key",
															"Show API key"
														)}
														aria-pressed={showApiKey}
														className="absolute right-0.5 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] text-muted-foreground hover:text-foreground"
													>
														{choose(
															showApiKey,
															<EyeOff className="h-4 w-4" />,
															<Eye className="h-4 w-4" />
														)}
													</button>
												</div>
												<p className="text-xs text-muted-foreground">
													{choose(
														hasStoredKey,
														"Your API key is saved. Enter a new key to update it.",
														"Enter your API key. It will be securely stored for AI generation."
													)}
												</p>
											</div>

											<AnimatePresence>
												<Show when={showBaseUrl}>
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
												</Show>
											</AnimatePresence>

											{/* Model Selection */}
											<div className="space-y-2">
												<ModelDropdown
													models={availableModels}
													value={selectedModel}
													onChange={setSelectedModel}
													disabled={any(loading, saving)}
												/>
											</div>

											<div className="flex flex-wrap items-center gap-3 pt-2">
												<Button
													onClick={saveSettings}
													disabled={any(
														saving,
														all(!apiKey.trim(), !selectedModel)
													)}
													variant="cap"
												>
													{choose(
														saving,
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Saving…
														</>,
														<>
															<Save className="mr-2 h-4 w-4" />
															Save settings
														</>
													)}
												</Button>

												<Button
													onClick={testConnection}
													disabled={any(loading, !apiKey.trim())}
													variant="outline"
												>
													{choose(
														loading,
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Testing...
														</>,
														<>
															<RefreshCw className="mr-2 h-4 w-4" />
															Test Connection
														</>
													)}
												</Button>

												<Button
													onClick={removeApiKey}
													disabled={any(removingKey, !hasStoredKey, saving)}
													variant="destructive"
												>
													{choose(
														removingKey,
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Removing...
														</>,
														<>
															<Trash2 className="mr-2 h-4 w-4" />
															Remove API Key
														</>
													)}
												</Button>

												<AnimatePresence>
													<Show when={Boolean(error)}>
														<motion.div
															initial={{ opacity: 0, x: -10 }}
															animate={{ opacity: 1, x: 0 }}
															exit={{ opacity: 0 }}
															className="flex items-center gap-2 text-sm text-destructive"
														>
															<AlertCircle className="h-4 w-4" />
															{error}
														</motion.div>
													</Show>
													<Show when={all(saveSuccess, !error)}>
														<motion.div
															initial={{ opacity: 0, x: -10 }}
															animate={{ opacity: 1, x: 0 }}
															exit={{ opacity: 0 }}
															className="flex items-center gap-2 text-sm text-[var(--success)]"
														>
															<CheckCircle2 className="h-4 w-4" />
															Settings saved!
														</motion.div>
													</Show>
													<Show when={all(success, !error, !saveSuccess)}>
														<motion.div
															initial={{ opacity: 0, x: -10 }}
															animate={{ opacity: 1, x: 0 }}
															exit={{ opacity: 0 }}
															className="flex items-center gap-2 text-sm text-[var(--success)]"
														>
															<CheckCircle2 className="h-4 w-4" />
															Connection verified!
														</motion.div>
													</Show>
												</AnimatePresence>
											</div>
										</>
									</Show>
								</CardContent>
							</Card>
						</div>
					</Show>

					{/* Account Tab */}
					<Show when={activeTab === "account"}>
						<div className="grid gap-6">
							<CareerStageSettings />
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
												<p className="font-medium">Two-Factor Authentication</p>
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
													Receive updates about your applications and resumes
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
												Permanently delete your account and all associated data
											</p>
										</div>
										<Button
											type="button"
											variant="destructive"
											size="sm"
											onClick={() => setActiveTab("privacy")}
										>
											Go to Data &amp; privacy
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>
					</Show>

					{/* Billing Tab */}
					<Show when={activeTab === "billing"}>
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
					</Show>

					{/* Integrations Tab */}
					<Show when={activeTab === "integrations"}>
						<div className="grid gap-6">
							{/* Calendar Integrations */}
							<Card>
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-lg">
										<Calendar className="h-5 w-5" />
										Calendar Integrations
									</CardTitle>
									<CardDescription>
										See your events beside your week in Focus and add the blocks you plan.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<GoogleCalendarCard />

									{/* Outlook Calendar */}
									<div className="flex items-center justify-between rounded-lg border p-4">
										<div className="flex items-center gap-3">
											<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--info-soft)]">
												<Image
													src="/outlook-calendar.svg"
													alt="Outlook Calendar"
													width={24}
													height={24}
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
													aria-hidden="true"
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
					</Show>
				</motion.div>
			</div>
		</div>
	);
}
