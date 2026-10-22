import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-[var(--danger-soft)] text-[var(--danger)]",
        outline: "border-border text-foreground",
        success: "border-transparent bg-[var(--success-soft)] text-[var(--success)]",
        warning: "border-transparent bg-[var(--cap-soft)] text-[var(--cap-ink)]",
        info: "border-transparent bg-[var(--info-soft)] text-[var(--info)]",
        // the product areas, as on the marketing site
        focus: "border-transparent bg-[var(--kind-focus-soft)] text-[var(--kind-focus)]",
        learn: "border-transparent bg-[var(--kind-learn-soft)] text-[var(--kind-learn)]",
        prep: "border-transparent bg-[var(--kind-prep-soft)] text-[var(--kind-prep)]",
        jobs: "border-transparent bg-[var(--kind-jobs-soft)] text-[var(--kind-jobs)]",
        interview: "border-transparent bg-[var(--kind-interview-soft)] text-[var(--kind-interview)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: Readonly<BadgeProps>) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
