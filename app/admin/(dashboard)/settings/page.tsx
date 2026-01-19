"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Shield } from "lucide-react";

export default function SettingsPage() {
	const [loading, setLoading] = useState(false);
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

			setSuccess("Password changed successfully");
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
		} catch (error) {
			setError("Something went wrong");
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Settings</h1>
				<p className="text-muted-foreground">
					Manage your admin account settings.
				</p>
			</div>

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
							<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								{error}
							</div>
						)}
						{success && (
							<div className="rounded-md bg-green-100 p-3 text-sm text-green-800 dark:bg-green-900 dark:text-green-300">
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
