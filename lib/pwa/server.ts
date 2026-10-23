import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushPlatform } from "./platform";

/**
 * Web push is on only when the server has a full VAPID key pair. The public key is safe to
 * send to the browser; the private key is used by the worker (worker/orbithire_worker/push).
 */
export function vapidPublicKey(): string | null {
	const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
	return key && process.env.VAPID_PRIVATE_KEY ? key : null;
}

export type PushEvent = "subscribed" | "unsubscribed" | "denied";

/** Opt-in/opt-out metric row; a failure here never blocks the user's action. */
export async function recordPushEvent(
	supabase: SupabaseClient,
	userId: string,
	platform: PushPlatform,
	event: PushEvent
): Promise<void> {
	const { error } = await supabase.from("push_events").insert({ user_id: userId, platform, event });
	if (error) console.error("[push] could not record event:", error);
}
