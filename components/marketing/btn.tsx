import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = {
	href: string;
	children: string;
	variant?: "primary" | "secondary";
	arrow?: boolean;
	className?: string;
};

/** The website button: label rolls on hover, a fill rises in an arch. */
export function Btn({ href, children, variant = "primary", arrow, className }: Readonly<BtnProps>) {
	return (
		<Link href={href} className={cn("nm-btn", variant === "primary" ? "nm-btn-primary" : "nm-btn-secondary", className)}>
			<span className="lbl">
				<span>{children}</span>
				<span aria-hidden="true">{children}</span>
			</span>
			{arrow && <ArrowRight className="ar" size={18} strokeWidth={1.75} aria-hidden="true" />}
		</Link>
	);
}
