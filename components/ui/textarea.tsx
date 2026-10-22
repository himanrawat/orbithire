import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					"flex w-full rounded-[var(--radius-control)] border border-input bg-card px-3.5 text-[15px] text-foreground ring-offset-background transition-[border-color,box-shadow] duration-[var(--duration-quick)] placeholder:text-muted-foreground hover:border-foreground/50 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 aria-[invalid=true]:border-destructive disabled:cursor-not-allowed disabled:opacity-50 min-h-[96px] py-2.5 leading-6",
					className
				)}
				ref={ref}
				{...props}
			/>
		);
	}
);
Textarea.displayName = "Textarea";

export { Textarea };
