"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash } from "lucide-react";

type Admin = {
	id: string;
	email: string;
	name: string;
	role: "admin" | "super_admin";
	is_active: boolean;
	created_at: string;
};

export function AdminsPanel({ admins }: Readonly<{ admins: Admin[] }>) {
	const [isSuperAdmin, setIsSuperAdmin] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [targetAdmin, setTargetAdmin] = useState<Admin | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Determine if current admin is super_admin
		const fetchRole = async () => {
			try {
				const res = await fetch("/api/auth/admin/verify", { cache: "no-store" });
				if (res.ok) {
					const data = await res.json();
					setIsSuperAdmin(data.role === "super_admin");
				}
			} catch (err) {
				console.error("Failed to verify admin role", err);
			}
		};
		fetchRole();
	}, []);

	const handleDelete = async () => {
		if (!targetAdmin) return;
		setLoading(true);
		try {
			const res = await fetch("/api/admin/admins", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "delete",
					adminId: targetAdmin.id,
				}),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to delete admin");
			}
			setDeleteOpen(false);
			setTargetAdmin(null);
			window.location.reload();
		} catch (err) {
			console.error(err);
			alert(err instanceof Error ? err.message : "Failed to delete admin");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Card className="border-border/60">
			<CardHeader className="hidden" />
			<CardContent className="space-y-3 pt-0 px-0 pb-6">
				{admins.length === 0 ? (
					<p className="text-sm text-muted-foreground">No admins yet.</p>
				) : (
					<div className="space-y-2">
						{admins.map((admin) => (
							<div
								key={admin.id}
								className="flex items-center justify-between rounded-md border px-3 py-2"
							>
								<div>
									<div className="flex items-center gap-2">
										<span className="font-medium">{admin.name}</span>
										<Badge variant={admin.role === "super_admin" ? "destructive" : "secondary"}>
											{admin.role === "super_admin" ? "Super Admin" : "Admin"}
										</Badge>
									</div>
									<p className="text-sm text-muted-foreground">{admin.email}</p>
								</div>
								{isSuperAdmin && admin.role !== "super_admin" && (
									<Button
										variant="ghost"
										size="icon"
										onClick={() => {
											setTargetAdmin(admin);
											setDeleteOpen(true);
										}}
									>
										<Trash className="h-4 w-4 text-destructive" />
									</Button>
								)}
							</div>
						))}
					</div>
				)}
			</CardContent>

			{/* Delete Admin Modal */}
			<Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Admin</DialogTitle>
						<DialogDescription>
							This removes the admin's access. Super admin cannot be deleted.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-1 py-2">
						<p className="text-sm">
							{targetAdmin?.name} ({targetAdmin?.email})
						</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={loading || !isSuperAdmin}
						>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete Admin
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

export function CreateAdminButton() {
	const [isSuperAdmin, setIsSuperAdmin] = useState(false);
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState({ name: "", email: "", password: "" });
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const fetchRole = async () => {
			try {
				const res = await fetch("/api/auth/admin/verify", { cache: "no-store" });
				if (res.ok) {
					const data = await res.json();
					setIsSuperAdmin(data.role === "super_admin");
				}
			} catch (err) {
				console.error("Failed to verify admin role", err);
			}
		};
		fetchRole();
	}, []);

	const handleCreate = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/admins", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "create",
					...form,
				}),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to create admin");
			}
			setOpen(false);
			setForm({ name: "", email: "", password: "" });
			window.location.reload();
		} catch (err) {
			console.error(err);
			alert(err instanceof Error ? err.message : "Failed to create admin");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<Button onClick={() => setOpen(true)} disabled={!isSuperAdmin}>
				Create Admin
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Admin</DialogTitle>
						<DialogDescription>Only super admin can create admins.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="Admin Name"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								value={form.email}
								onChange={(e) => setForm({ ...form, email: e.target.value })}
								placeholder="admin@example.com"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={form.password}
								onChange={(e) => setForm({ ...form, password: e.target.value })}
								placeholder="At least 8 characters"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreate} disabled={loading || !isSuperAdmin}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
};
