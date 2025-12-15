"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Rocket } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { hasSupabaseSessionCookie, sanitizeRedirect } from "@/lib/auth-utils";

type User = {
	name: string;
	avatarUrl?: string;
};

export function NavBar({ user }: { user?: User | null }) {
	const [resolvedUser, setResolvedUser] = useState<User | null>(user ?? null);
	const searchParams = useSearchParams();

	useEffect(() => {
		if (user) return;

		// Skip API call if no session cookie exists
		if (!hasSupabaseSessionCookie()) {
			return;
		}

		const loadUser = async () => {
			try {
				const supabase = getSupabaseBrowserClient();
				const {
					data: { user: authUser },
				} = await supabase.auth.getUser();
				if (!authUser) return;

				// Try to get profile data, fallback to auth user email
				const { data: profile } = await supabase
					.from("profiles")
					.select("full_name, avatar_url")
					.eq("id", authUser.id)
					.single();

				setResolvedUser({
					name:
						profile?.full_name ||
						authUser.user_metadata?.full_name ||
						authUser.email ||
						"",
					avatarUrl: profile?.avatar_url || undefined,
				});
			} catch {
				// Ignore failures
			}
		};
		void loadUser();
	}, [user]);

	const navUser = resolvedUser || user;
	const redirect = searchParams.get("redirect");
	const redirectQuery = redirect
		? `?redirect=${encodeURIComponent(sanitizeRedirect(redirect, ""))}`
		: "";

	return (
		<header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="container flex h-14 items-center justify-between">
				<Link href="/" className="flex items-center space-x-2">
					<span className="font-bold text-lg">CVLeap AI</span>
				</Link>
				<div className="flex items-center gap-2">
					<ThemeToggle />
					{navUser ? (
						<>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								{navUser.avatarUrl && (
									<img
										src={navUser.avatarUrl}
										alt={navUser.name}
										className="h-8 w-8 rounded-full border"
									/>
								)}
								<span>{navUser.name}</span>
							</div>
							<Button variant="outline" size="sm" asChild>
								<Link href="/dashboard">Dashboard</Link>
							</Button>
						</>
					) : (
						<>
							<Button variant="ghost" size="sm" asChild>
								<Link href={`/signin${redirectQuery}`}>Sign in</Link>
							</Button>
							<Button size="sm" asChild>
								<Link href={`/signup${redirectQuery}`}>Get started</Link>
							</Button>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
