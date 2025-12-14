"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { ModelInfo } from "@/lib/ai/providers/registry";

interface ModelDropdownProps {
	models: ModelInfo[];
	value: string;
	onChange: (modelId: string) => void;
	disabled?: boolean;
}

export function ModelDropdown({
	models,
	value,
	onChange,
	disabled = false,
}: ModelDropdownProps) {
	// Group models by category
	const recommended = models.filter((m) => m.category === "recommended");
	const alternative = models.filter((m) => m.category === "alternative");
	const experimental = models.filter((m) => m.category === "experimental");
	const deprecated = models.filter((m) => m.category === "deprecated");

	const getCategoryBadge = (category: string) => {
		switch (category) {
			case "recommended":
				return (
					<span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
						<CheckCircle2 className="h-3 w-3" />
						Recommended
					</span>
				);
			case "alternative":
				return (
					<span className="text-xs text-blue-600 dark:text-blue-400">
						Alternative
					</span>
				);
			case "experimental":
				return (
					<span className="text-xs text-amber-600 dark:text-amber-400">
						⚠️ Experimental
					</span>
				);
			case "deprecated":
				return (
					<span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
						<AlertCircle className="h-3 w-3" />
						Deprecated
					</span>
				);
			default:
				return null;
		}
	};

	return (
		<div className="space-y-2">
			<Label htmlFor="model-select">Model</Label>
			<select
				id="model-select"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{!value && <option value="">Select a model...</option>}

				{recommended.length > 0 && (
					<optgroup label="✓ Recommended">
						{recommended.map((model) => (
							<option key={model.id} value={model.id}>
								{model.name} - {model.description.substring(0, 50)}...
							</option>
						))}
					</optgroup>
				)}

				{alternative.length > 0 && (
					<optgroup label="Alternative">
						{alternative.map((model) => (
							<option key={model.id} value={model.id}>
								{model.name} - {model.description.substring(0, 50)}...
							</option>
						))}
					</optgroup>
				)}

				{experimental.length > 0 && (
					<optgroup label="⚠️ Experimental">
						{experimental.map((model) => (
							<option key={model.id} value={model.id}>
								{model.name} - {model.description.substring(0, 50)}...
							</option>
						))}
					</optgroup>
				)}

				{deprecated.length > 0 && (
					<optgroup label="❌ Deprecated (Not Recommended)">
						{deprecated.map((model) => (
							<option key={model.id} value={model.id}>
								{model.name} - DEPRECATED
							</option>
						))}
					</optgroup>
				)}
			</select>

			{/* Show model details for selected model */}
			{value && (
				<div className="mt-2 rounded-md bg-gray-50 dark:bg-gray-800/50 p-3 text-sm">
					{(() => {
						const selectedModel = models.find((m) => m.id === value);
						if (!selectedModel) return null;

						return (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="font-medium">{selectedModel.name}</span>
									{getCategoryBadge(selectedModel.category)}
								</div>
								<p className="text-xs text-gray-600 dark:text-gray-400">
									{selectedModel.description}
								</p>
								<div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
									<span>Speed: {selectedModel.performance.speed}/10</span>
									<span>•</span>
									<span>Quality: {selectedModel.performance.quality}/10</span>
									<span>•</span>
									<span>
										Context: {selectedModel.contextWindow.toLocaleString()}{" "}
										tokens
									</span>
								</div>
							</div>
						);
					})()}
				</div>
			)}
		</div>
	);
}
