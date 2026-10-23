"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Shield } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

export default function SettingsPage() {
	const [saving, setSaving] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");

	const handlePasswordChange = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccess("");

		if (newPassword !== confirmPassword) {
			setError("New passwords do not match");
			return;
		}

		if (newPassword.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}

		setSaving(true);

		try {
			const res = await fetch("/api/admin/settings/password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ currentPassword, newPassword }),
			});

			const data = await res.json();

			if (!res.ok) {
				setError(data.error || "Failed to change password");
				return;
			}

			// The server revokes every session on a password change, so sign in again.
			setSuccess("Password changed. Taking you to sign in with your new password…");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			window.location.assign("/admin/signin");
		} catch {
			setError("Something went wrong");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<PageHeader title="Settings" description="Manage your admin account settings." className="mb-0" />

			{/* Change Password */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Shield className="h-5 w-5" />
						Change Password
					</CardTitle>
					<CardDescription>
						Update your admin account password.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
						<div className="space-y-2">
							<Label htmlFor="currentPassword">Current Password</Label>
							<Input
								id="currentPassword"
								type="password"
								value={currentPassword}
								onChange={(e) => setCurrentPassword(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="newPassword">New Password</Label>
							<Input
								id="newPassword"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmPassword">Confirm New Password</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
							/>
						</div>
						{error && (
							<div className="rounded-[var(--radius-control)] bg-[var(--danger-soft)] p-3 text-sm text-[var(--danger)]">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-md bg-[var(--success-soft)] p-3 text-sm text-[var(--success)]">
								{success}
							</div>
						)}
						<Button type="submit" disabled={saving}>
							{saving ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Save className="mr-2 h-4 w-4" />
							)}
							Change Password
						</Button>
					</form>
				</CardContent>
			</Card>

			{/* Platform Info */}
			<Card>
				<CardHeader>
					<CardTitle>Platform Information</CardTitle>
					<CardDescription>
						Current platform configuration.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div>
							<Label className="text-muted-foreground">Default Credits for New Users</Label>
							<p className="text-lg font-medium">2 credits</p>
						</div>
						<div>
							<Label className="text-muted-foreground">Admin Panel Version</Label>
							<p className="text-lg font-medium">1.0.0</p>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
