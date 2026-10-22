"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CalendarProps {
	selected?: Date;
	onSelect?: (date: Date | undefined) => void;
	className?: string;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

function Calendar({ selected, onSelect, className }: CalendarProps) {
	const [viewDate, setViewDate] = React.useState(() => selected || new Date());

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	// Get first day of month and total days
	const firstDayOfMonth = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();

	// Generate calendar grid
	const days: (number | null)[] = [];
	for (let i = 0; i < firstDayOfMonth; i++) {
		days.push(null);
	}
	for (let i = 1; i <= daysInMonth; i++) {
		days.push(i);
	}

	const prevMonth = () => {
		setViewDate(new Date(year, month - 1, 1));
	};

	const nextMonth = () => {
		setViewDate(new Date(year, month + 1, 1));
	};

	const isSelected = (day: number) => {
		if (!selected) return false;
		return (
			selected.getDate() === day &&
			selected.getMonth() === month &&
			selected.getFullYear() === year
		);
	};

	const isToday = (day: number) => {
		const today = new Date();
		return (
			today.getDate() === day &&
			today.getMonth() === month &&
			today.getFullYear() === year
		);
	};

	const handleSelect = (day: number) => {
		onSelect?.(new Date(year, month, day));
	};

	return (
		<div className={cn("p-3", className)}>
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={prevMonth}
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<span className="text-sm font-medium">
					{MONTHS[month]} {year}
				</span>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7"
					onClick={nextMonth}
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>

			{/* Day headers */}
			<div className="grid grid-cols-7 gap-1 mb-2">
				{DAYS.map((day) => (
					<div
						key={day}
						className="text-center text-xs text-muted-foreground font-medium py-1"
					>
						{day}
					</div>
				))}
			</div>

			{/* Days grid */}
			<div className="grid grid-cols-7 gap-1">
				{days.map((day, idx) => (
					<div key={idx} className="aspect-square">
						{day && (
							<button
								type="button"
								onClick={() => handleSelect(day)}
								className={cn(
									"w-full h-full rounded-[var(--radius-sm)] text-sm tabular-nums transition-colors",
									"hover:bg-accent hover:text-accent-foreground",
									"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
									isSelected(day) &&
										"bg-cap font-semibold text-cap-foreground hover:bg-cap",
									isToday(day) &&
										!isSelected(day) &&
										"font-semibold ring-1 ring-inset ring-input"
								)}
							>
								{day}
							</button>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

Calendar.displayName = "Calendar";

export { Calendar };
export type { CalendarProps };
