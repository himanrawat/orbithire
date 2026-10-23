"use client";

import { Button } from "@/components/ui/button";
import { nativeSelectClass } from "@/components/app/blocks";
import {
	COMPANY_TYPES,
	COMPANY_TYPE_LABELS,
	LEVEL_LABELS,
	PREP_LEVELS,
	PREP_ROLES,
	PREP_STAGES,
	PREP_TOPICS,
	ROLE_LABELS,
	STAGE_LABELS,
	TOPIC_LABELS,
} from "@/lib/prep/constants";
import { EMPTY_FILTERS, activeFilterCount, type FilterState } from "@/lib/prep/filters";

type SelectKey = "role" | "topic" | "level" | "stage" | "companyType";

type SelectSpec = Readonly<{
	key: SelectKey;
	label: string;
	any: string;
	options: readonly (readonly [string, string])[];
}>;

function entries<T extends string>(values: readonly T[], labels: Readonly<Record<T, string>>) {
	return values.map((v) => [v, labels[v]] as const);
}

const SELECTS: readonly SelectSpec[] = [
	{ key: "role", label: "Role", any: "Any role", options: entries(PREP_ROLES, ROLE_LABELS) },
	{ key: "topic", label: "Topic", any: "Any topic", options: entries(PREP_TOPICS, TOPIC_LABELS) },
	{ key: "level", label: "Level", any: "Any level", options: entries(PREP_LEVELS, LEVEL_LABELS) },
	{ key: "stage", label: "Stage", any: "Any stage", options: entries(PREP_STAGES, STAGE_LABELS) },
	{
		key: "companyType",
		label: "Company type",
		any: "Any company",
		options: entries(COMPANY_TYPES, COMPANY_TYPE_LABELS),
	},
];

type QuestionFiltersProps = Readonly<{
	value: FilterState;
	onChange: (next: FilterState) => void;
}>;

export function QuestionFilters({ value, onChange }: QuestionFiltersProps) {
	const count = activeFilterCount(value);
	return (
		<fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			<legend className="sr-only">Filter questions</legend>
			{SELECTS.map((spec) => (
				<label key={spec.key} className="grid gap-1.5 text-sm font-[550]">
					{spec.label}
					<select
						className={nativeSelectClass}
						value={value[spec.key]}
						onChange={(e) => onChange({ ...value, [spec.key]: e.target.value })}
					>
						<option value="">{spec.any}</option>
						{spec.options.map(([v, label]) => (
							<option key={v} value={v}>
								{label}
							</option>
						))}
					</select>
				</label>
			))}
			<div className="flex items-end justify-between gap-3">
				<label className="flex min-h-11 items-center gap-2 text-sm font-[550]">
					<input
						type="checkbox"
						className="h-4 w-4 accent-[var(--cap)]"
						checked={value.mostAsked}
						onChange={(e) => onChange({ ...value, mostAsked: e.target.checked })}
					/>
					Most asked only
				</label>
				{count > 0 && (
					<Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
						Clear filters
					</Button>
				)}
			</div>
		</fieldset>
	);
}
