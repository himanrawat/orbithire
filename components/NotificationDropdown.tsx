"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Bell,
	FileText,
	Calendar,
	Clock,
	CheckCircle2,
	Loader2,
	Trash2,
	Building2,
	Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
	id: string;
	type: string;
	title: string;
	message: string;
	resource_type: string | null;
	resource_id: string | null;
	action_url: string | null;
	read: boolean;
	created_at: string;
};

const notificationIcons: Record<string, React.ReactNode> = {
	resume_created: <FileText className="h-4 w-4 text-blue-500" />,
	resume_downloaded: <FileText className="h-4 w-4 text-green-500" />,
	interview_reminder: <Calendar className="h-4 w-4 text-purple-500" />,
	follow_up_reminder: <Clock className="h-4 w-4 text-orange-500" />,
	application_update: <Building2 className="h-4 w-4 text-indigo-500" />,
	system: <Sparkles className="h-4 w-4 text-gray-500" />,
};

function formatTimeAgo(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "Just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}

export function NotificationDropdown() {
	const router = useRouter();
	const [notifications, setNotifications] = useState<Notification[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [open, setOpen] = useState(false);

	const fetchNotifications = useCallback(async () => {
		try {
			const res = await fetch("/api/notifications?limit=10");
			if (res.ok) {
				const data = await res.json();
				setNotifications(data.notifications || []);
				setUnreadCount(data.unreadCount || 0);
			}
		} catch (error) {
			console.error("Failed to fetch notifications:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchNotifications();
		// Poll for new notifications every 30 seconds
		const interval = setInterval(fetchNotifications, 30000);
		return () => clearInterval(interval);
	}, [fetchNotifications]);

	const markAsRead = async (notificationIds: string[]) => {
		try {
			await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ notificationIds }),
			});
			setNotifications((prev) =>
				prev.map((n) =>
					notificationIds.includes(n.id) ? { ...n, read: true } : n
				)
			);
			setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
		} catch (error) {
			console.error("Failed to mark notifications as read:", error);
		}
	};

	const markAllAsRead = async () => {
		try {
			await fetch("/api/notifications", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ markAllRead: true }),
			});
			setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
			setUnreadCount(0);
		} catch (error) {
			console.error("Failed to mark all notifications as read:", error);
		}
	};

	const deleteNotification = async (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
			const deleted = notifications.find((n) => n.id === id);
			setNotifications((prev) => prev.filter((n) => n.id !== id));
			if (deleted && !deleted.read) {
				setUnreadCount((prev) => Math.max(0, prev - 1));
			}
		} catch (error) {
			console.error("Failed to delete notification:", error);
		}
	};

	const handleNotificationClick = (notification: Notification) => {
		if (!notification.read) {
			markAsRead([notification.id]);
		}
		if (notification.action_url) {
			router.push(notification.action_url);
			setOpen(false);
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" className="relative">
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<div className="flex items-center justify-between px-3 py-2">
					<span className="font-semibold">Notifications</span>
					{unreadCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
							onClick={markAllAsRead}
						>
							<CheckCircle2 className="mr-1 h-3 w-3" />
							Mark all read
						</Button>
					)}
				</div>
				<DropdownMenuSeparator />

				{loading ? (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
					</div>
				) : notifications.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<Bell className="mb-2 h-8 w-8 text-muted-foreground/50" />
						<p className="text-sm text-muted-foreground">No notifications yet</p>
					</div>
				) : (
					<div className="max-h-[400px] overflow-y-auto">
						{notifications.map((notification) => (
							<DropdownMenuItem
								key={notification.id}
								className={cn(
									"flex cursor-pointer items-start gap-3 px-3 py-3",
									!notification.read && "bg-muted/50"
								)}
								onClick={() => handleNotificationClick(notification)}
							>
								<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
									{notificationIcons[notification.type] || (
										<Bell className="h-4 w-4 text-muted-foreground" />
									)}
								</div>
								<div className="flex-1 space-y-1">
									<div className="flex items-start justify-between gap-2">
										<p
											className={cn(
												"text-sm leading-tight",
												!notification.read && "font-medium"
											)}
										>
											{notification.title}
										</p>
										<button
											onClick={(e) => deleteNotification(notification.id, e)}
											className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100 [.group:hover_&]:opacity-100"
										>
											<Trash2 className="h-3 w-3" />
										</button>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-2">
										{notification.message}
									</p>
									<p className="text-[10px] text-muted-foreground/70">
										{formatTimeAgo(notification.created_at)}
									</p>
								</div>
								{!notification.read && (
									<div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
								)}
							</DropdownMenuItem>
						))}
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
