import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
	extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(
					"flex w-full rounded-[var(--radius-control)] border border-input bg-card px-3.5 text-[15px] text-foreground ring-offset-background transition-[border-color,box-shadow] duration-[var(--duration-quick)] placeholder:text-muted-foreground hover:border-foreground/50 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50 h-11 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium",
					className
				)}
				ref={ref}
				{...props}
			/>
		);
	}
);
Input.displayName = "Input";

export { Input };
