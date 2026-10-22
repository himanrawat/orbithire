import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
	// NextMilestone: 10px control radius, semibold labels, 44px targets on phones.
	// `cap` is the yellow main action, used once per screen; `default` is ink.
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow] duration-[var(--duration-quick)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&>svg]:m-0",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/85",
				cap: "bg-cap text-cap-foreground hover:bg-[var(--cap-press)]",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline:
					"border border-input bg-card hover:border-foreground/60 hover:bg-accent hover:text-accent-foreground",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/70",
				ghost: "hover:bg-accent hover:text-accent-foreground",
				link: "h-auto px-0 text-[var(--info)] underline underline-offset-2 hover:decoration-2",
			},
			size: {
				default: "h-10 px-4 max-sm:h-11",
				sm: "h-9 px-3",
				lg: "h-12 px-6 text-[15px]",
				icon: "h-10 w-10 max-sm:h-11 max-sm:w-11",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = "Button";

export { Button, buttonVariants };
