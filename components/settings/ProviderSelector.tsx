"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface ProviderSelectorProps {
	value: string;
	onChange: (provider: string) => void;
	disabled?: boolean;
}

const providers = [
	{
		id: "openai",
		name: "OpenAI",
		icon: "/OpenAI-dark.svg",
		bg: "bg-black",
	},
	{
		id: "groq",
		name: "Groq",
		icon: "/groq-logo.svg",
		bg: "bg-[#F43E01]",
	},
	{
		id: "anthropic",
		name: "Anthropic",
		icon: "/Anthropic_light.svg",
		bg: "bg-[#d97757]",
	},
	{
		id: "gemini",
		name: "Gemini",
		icon: "/gemini.svg",
		bg: "",
	},
];

export function ProviderSelector({
	value,
	onChange,
	disabled = false,
}: Readonly<ProviderSelectorProps>) {
	return (
		<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
			{providers.map((provider) => {
				const isSelected = value === provider.id;

				return (
					<button
						key={provider.id}
						type="button"
						onClick={() => onChange(provider.id)}
						disabled={disabled}
						className={cn(
							"relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all",
							"hover:shadow-lg hover:scale-105",
							"disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
							isSelected
								? "border-primary bg-primary/5 shadow-md"
								: "border-border hover:border-border"
						)}
					>
						<div
							className={cn(
								`p-2 rounded-full mb-2 w-12 h-12 flex items-center justify-center ${provider.bg}`,
								!isSelected && "opacity-75"
							)}
						>
							<Image
								src={provider.icon}
								alt={provider.name}
								width={48}
								height={48}
								className="h-full w-full"
							/>
						</div>
						<span
							className={cn(
								"text-sm font-medium",
								isSelected ? "text-primary" : "text-foreground"
							)}
						>
							{provider.name}
						</span>
						{isSelected && (
							<div className="absolute top-2 right-2">
								<div className="h-2 w-2 rounded-full bg-[var(--success)]" />
							</div>
						)}
					</button>
				);
			})}
		</div>
	);
}
