import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";
import { z } from "zod";
import { parseJson } from "@/lib/api";

const patchSchema = z.object({
	notificationIds: z.array(z.string().uuid()).max(100).optional(),
	markAllRead: z.boolean().optional(),
}).strict().refine((value) => value.markAllRead || (value.notificationIds?.length ?? 0) > 0, {
	message: "notificationIds are required unless markAllRead is true",
});

export const runtime = "nodejs";

// GET /api/notifications - List all notifications for the current user
export async function GET(request: NextRequest) {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const unreadOnly = searchParams.get("unread") === "true";
		const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));

		let query = supabase
			.from("notifications")
			.select("id,type,title,message,resource_type,resource_id,action_url,read,read_at,created_at")
			.eq("user_id", user.id)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (unreadOnly) {
			query = query.eq("read", false);
		}

		const { data: notifications, error } = await query;

		if (error) {
			console.error("Error fetching notifications:", error);
			return NextResponse.json(
				{ error: "Failed to fetch notifications" },
				{ status: 500 }
			);
		}

		// Get unread count
		const { count: unreadCount, error: countError } = await supabase
			.from("notifications")
			.select("id", { count: "exact", head: true })
			.eq("user_id", user.id)
			.eq("read", false);

		if (countError) {
			console.error("Error counting unread notifications:", countError);
		}

		return NextResponse.json({
			notifications: notifications || [],
			unreadCount: unreadCount || 0,
		});
	} catch (error) {
		console.error("Notifications GET error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// PATCH /api/notifications - Mark notifications as read
export async function PATCH(request: NextRequest) {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const parsed = await parseJson(request, patchSchema);
		if (!parsed.success) return parsed.response;
		const { notificationIds, markAllRead } = parsed.data;

		if (markAllRead) {
			// Mark all notifications as read
			const { error } = await supabase
				.from("notifications")
				.update({ read: true, read_at: new Date().toISOString() })
				.eq("user_id", user.id)
				.eq("read", false);

			if (error) {
				console.error("Error marking all notifications as read:", error);
				return NextResponse.json(
					{ error: "Failed to mark notifications as read" },
					{ status: 500 }
				);
			}

			return NextResponse.json({ success: true, markedAll: true });
		}

		if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
			return NextResponse.json(
				{ error: "notificationIds array is required" },
				{ status: 400 }
			);
		}

		// Mark specific notifications as read
		const { error } = await supabase
			.from("notifications")
			.update({ read: true, read_at: new Date().toISOString() })
			.eq("user_id", user.id)
			.in("id", notificationIds);

		if (error) {
			console.error("Error marking notifications as read:", error);
			return NextResponse.json(
				{ error: "Failed to mark notifications as read" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ success: true, markedIds: notificationIds });
	} catch (error) {
		console.error("Notifications PATCH error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

// DELETE /api/notifications - Delete notifications
export async function DELETE(request: NextRequest) {
	try {
		const supabase = createServerSupabase();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();

		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { searchParams } = new URL(request.url);
		const notificationId = searchParams.get("id");
		const deleteAll = searchParams.get("all") === "true";

		if (deleteAll) {
			const { error } = await supabase
				.from("notifications")
				.delete()
				.eq("user_id", user.id);

			if (error) {
				console.error("Error deleting all notifications:", error);
				return NextResponse.json(
					{ error: "Failed to delete notifications" },
					{ status: 500 }
				);
			}

			return NextResponse.json({ success: true, deletedAll: true });
		}

		if (!notificationId) {
			return NextResponse.json(
				{ error: "Notification ID is required" },
				{ status: 400 }
			);
		}

		const { error } = await supabase
			.from("notifications")
			.delete()
			.eq("user_id", user.id)
			.eq("id", notificationId);

		if (error) {
			console.error("Error deleting notification:", error);
			return NextResponse.json(
				{ error: "Failed to delete notification" },
				{ status: 500 }
			);
		}

		return NextResponse.json({ success: true, deletedId: notificationId });
	} catch (error) {
		console.error("Notifications DELETE error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
