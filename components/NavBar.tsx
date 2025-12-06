"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Rocket } from "lucide-react";

type User = {
	name: string;
	avatarUrl?: string;
};

export function NavBar({ user }: { user?: User | null }) {
	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-14 items-center justify-between">
				<Link href="/" className="flex items-center space-x-2">
					<Rocket className="h-5 w-5" />
					<span className="font-bold text-lg">OrbitHire</span>
				</Link>
				<div className="flex items-center gap-2">
					<ThemeToggle />
					{user ? (
						<>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								{user.avatarUrl && (
									<img
										src={user.avatarUrl}
										alt={user.name}
										className="h-8 w-8 rounded-full border"
									/>
								)}
								<span>{user.name}</span>
							</div>
							<Button variant="outline" size="sm" asChild>
								<Link href="/dashboard">Dashboard</Link>
							</Button>
						</>
					) : (
						<>
							<Button variant="ghost" size="sm" asChild>
								<Link href="/signin">Sign in</Link>
							</Button>
							<Button size="sm" asChild>
								<Link href="/signup">Get started</Link>
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
