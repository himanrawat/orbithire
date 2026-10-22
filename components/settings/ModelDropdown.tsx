"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { ModelInfo } from "@/lib/ai/providers/registry";
import { nativeSelectClass } from "@/components/app/blocks";

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
}: Readonly<ModelDropdownProps>) {
	// Group models by category
	const recommended = models.filter((m) => m.category === "recommended");
	const alternative = models.filter((m) => m.category === "alternative");
	const experimental = models.filter((m) => m.category === "experimental");
	const deprecated = models.filter((m) => m.category === "deprecated");

	const getCategoryBadge = (category: string) => {
		switch (category) {
			case "recommended":
				return (
					<span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
						<CheckCircle2 className="h-3 w-3" />
						Recommended
					</span>
				);
			case "alternative":
				return (
					<span className="text-xs text-[var(--info)]">
						Alternative
					</span>
				);
			case "experimental":
				return (
					<span className="text-xs text-[var(--cap-ink)]">
						⚠️ Experimental
					</span>
				);
			case "deprecated":
				return (
					<span className="inline-flex items-center gap-1 text-xs text-[var(--danger)]">
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
				className={nativeSelectClass}
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
				<div className="mt-2 rounded-md bg-secondary p-3 text-sm">
					{(() => {
						const selectedModel = models.find((m) => m.id === value);
						if (!selectedModel) return null;

						return (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<span className="font-medium">{selectedModel.name}</span>
									{getCategoryBadge(selectedModel.category)}
								</div>
								<p className="text-xs text-muted-foreground">
									{selectedModel.description}
								</p>
								<div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
