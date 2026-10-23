"use client";

// Target locations: "Remote (US)" and US metro areas, searchable, with chosen places shown
// as removable chips. A place that isn't on the list can be added as typed.

import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { filterLocations, hasExactLocation } from "@/lib/onboarding/locations";
import { ONBOARDING_LIMITS, toggleInList } from "@/lib/onboarding/stages";

const MAX = ONBOARDING_LIMITS.locations;

function ChosenLocations({ value, onRemove }: Readonly<{ value: readonly string[]; onRemove: (place: string) => void }>) {
	if (value.length === 0) {
		return <p className="text-sm text-muted-foreground">No places chosen yet.</p>;
	}
	return (
		<ul className="flex flex-wrap gap-2" aria-label="Chosen locations">
			{value.map((place) => (
				<li key={place}>
					<button
						type="button"
						onClick={() => onRemove(place)}
						aria-label={`Remove ${place}`}
						className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-secondary px-3 text-sm font-medium transition-colors hover:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{place}
						<X className="h-3.5 w-3.5" aria-hidden="true" />
					</button>
				</li>
			))}
		</ul>
	);
}

export function LocationPicker({
	value,
	onChange,
}: Readonly<{ value: readonly string[]; onChange: (places: string[]) => void }>) {
	const searchId = useId();
	const [query, setQuery] = useState("");
	const options = filterLocations(query);
	const atLimit = value.length >= MAX;
	const custom = query.trim().slice(0, ONBOARDING_LIMITS.locationLength);
	const canAddCustom = custom.length > 1 && !hasExactLocation(custom) && !value.includes(custom) && !atLimit;

	const toggle = (place: string) => onChange(toggleInList(value, place, MAX));
	const addCustom = () => {
		if (!canAddCustom) return;
		onChange([...value, custom]);
		setQuery("");
	};
	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		addCustom();
	};

	return (
		<div className="grid gap-3">
			<ChosenLocations value={value} onRemove={toggle} />
			<div className="grid gap-1.5">
				<Label htmlFor={searchId}>Search US metro areas</Label>
				<div className="flex gap-2">
					<Input
						id={searchId}
						type="search"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={onKeyDown}
						placeholder="e.g. Austin or Remote"
						autoComplete="off"
					/>
					{canAddCustom && (
						<Button type="button" variant="outline" onClick={addCustom} className="h-11">
							<Plus className="h-4 w-4" aria-hidden="true" />
							Add
						</Button>
					)}
				</div>
			</div>
			<fieldset>
				<legend className="sr-only">Locations</legend>
				<div className="max-h-64 overflow-y-auto rounded-[var(--radius-md)] border">
					{options.map((place) => {
						const checked = value.includes(place);
						return (
							<label
								key={place}
								className="flex min-h-11 cursor-pointer items-center gap-3 border-b px-4 text-sm last:border-b-0 hover:bg-accent has-[:focus-visible]:bg-accent"
							>
								<input
									type="checkbox"
									checked={checked}
									disabled={!checked && atLimit}
									onChange={() => toggle(place)}
									className="h-4 w-4 flex-none accent-[var(--cap)]"
								/>
								{place}
							</label>
						);
					})}
					{options.length === 0 && (
						<p className="px-4 py-3 text-sm text-muted-foreground">No metro area matches. Use Add to keep it as typed.</p>
					)}
				</div>
			</fieldset>
			<output aria-live="polite" className="block text-sm text-muted-foreground">
				{value.length} of {MAX} places chosen
			</output>
		</div>
	);
}
