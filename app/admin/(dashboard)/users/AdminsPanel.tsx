"use client";

// Owner-only admin management: list, re-role, remove and create admins and moderators.
// The page that renders this is gated to the owner; the API checks again.

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { nativeSelectClass } from "@/components/app/blocks";
import { Loader2, Trash } from "lucide-react";
import {
	ASSIGNABLE_ADMIN_ROLES,
	adminRoleLabel,
	type AdminRole,
	type AssignableAdminRole,
} from "@/lib/adminRoles";

type Admin = {
	id: string;
	email: string;
	name: string;
	role: AdminRole;
	is_active: boolean;
	created_at: string;
};

type AdminActionBody =
	| { action: "create"; name: string; email: string; password: string; role: AssignableAdminRole }
	| { action: "delete"; adminId: string }
	| { action: "set_role"; adminId: string; role: AssignableAdminRole };

async function postAdminAction(body: AdminActionBody) {
	const res = await fetch("/api/admin/admins", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(data.error || "That didn't work. Try again.");
	}
}

async function runAndReload(body: AdminActionBody) {
	try {
		await postAdminAction(body);
		window.location.reload();
		return true;
	} catch (err) {
		alert(err instanceof Error ? err.message : "That didn't work. Try again.");
		return false;
	}
}

function roleBadgeVariant(role: AdminRole) {
	if (role === "super_admin") return "destructive";
	if (role === "moderator") return "outline";
	return "secondary";
}

function RoleSelect({
	id,
	value,
	disabled,
	onChange,
	label,
}: Readonly<{
	id: string;
	value: AssignableAdminRole;
	disabled?: boolean;
	onChange: (role: AssignableAdminRole) => void;
	label: string;
}>) {
	return (
		<select
			id={id}
			aria-label={label}
			className={nativeSelectClass}
			value={value}
			disabled={disabled}
			onChange={(e) => onChange(e.target.value as AssignableAdminRole)}
		>
			{ASSIGNABLE_ADMIN_ROLES.map((role) => (
				<option key={role} value={role}>
					{adminRoleLabel(role)}
				</option>
			))}
		</select>
	);
}

function AdminRow({
	admin,
	canManage,
	onDelete,
}: Readonly<{ admin: Admin; canManage: boolean; onDelete: (admin: Admin) => void }>) {
	const [saving, setSaving] = useState(false);

	const changeRole = async (role: AssignableAdminRole) => {
		setSaving(true);
		const ok = await runAndReload({ action: "set_role", adminId: admin.id, role });
		if (!ok) setSaving(false);
	};

	return (
		<li className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
			<div className="min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-medium">{admin.name}</span>
					<Badge variant={roleBadgeVariant(admin.role)}>{adminRoleLabel(admin.role)}</Badge>
				</div>
				<p className="text-sm text-muted-foreground">{admin.email}</p>
			</div>
			{canManage && admin.role !== "super_admin" && (
				<div className="flex items-center gap-2">
					<RoleSelect
						id={`role-${admin.id}`}
						label={`Role for ${admin.name}`}
						value={admin.role as AssignableAdminRole}
						disabled={saving}
						onChange={(role) => void changeRole(role)}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`Remove ${admin.name}`}
						onClick={() => onDelete(admin)}
					>
						<Trash className="h-4 w-4 text-destructive" />
					</Button>
				</div>
			)}
		</li>
	);
}

export function AdminsPanel({ admins, ownerId }: Readonly<{ admins: Admin[]; ownerId: string }>) {
	const [targetAdmin, setTargetAdmin] = useState<Admin | null>(null);
	const [loading, setLoading] = useState(false);

	const handleDelete = async () => {
		if (!targetAdmin) return;
		setLoading(true);
		const ok = await runAndReload({ action: "delete", adminId: targetAdmin.id });
		if (!ok) setLoading(false);
	};

	return (
		<Card className="border-border/60">
			<CardContent className="space-y-3 px-0 pb-6 pt-0">
				{admins.length === 0 ? (
					<p className="text-sm text-muted-foreground">No admins yet.</p>
				) : (
					<ul className="space-y-2" aria-label="Admins">
						{admins.map((admin) => (
							<AdminRow
								key={admin.id}
								admin={admin}
								canManage={admin.id !== ownerId}
								onDelete={setTargetAdmin}
							/>
						))}
					</ul>
				)}
			</CardContent>

			<Dialog open={targetAdmin !== null} onOpenChange={(open) => !open && setTargetAdmin(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Remove admin</DialogTitle>
						<DialogDescription>
							This removes their access and signs them out everywhere. The owner can&apos;t be removed.
						</DialogDescription>
					</DialogHeader>
					<p className="py-2 text-sm">
						{targetAdmin?.name} ({targetAdmin?.email})
					</p>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setTargetAdmin(null)}>
							Cancel
						</Button>
						<Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={loading}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Remove admin
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "admin" as AssignableAdminRole };

export function CreateAdminButton() {
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY_FORM);
	const [loading, setLoading] = useState(false);

	const handleCreate = async () => {
		setLoading(true);
		const ok = await runAndReload({ action: "create", ...form });
		if (ok) {
			setOpen(false);
			setForm(EMPTY_FORM);
		}
		setLoading(false);
	};

	return (
		<>
			<Button type="button" onClick={() => setOpen(true)}>
				Add admin
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add admin</DialogTitle>
						<DialogDescription>
							Share the temporary password privately. They&apos;ll set their own at first sign-in.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3 py-2">
						<div className="space-y-2">
							<Label htmlFor="name">Name</Label>
							<Input
								id="name"
								value={form.name}
								onChange={(e) => setForm({ ...form, name: e.target.value })}
								placeholder="Jordan Lee"
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
							<Label htmlFor="password">Temporary password</Label>
							<Input
								id="password"
								type="password"
								value={form.password}
								onChange={(e) => setForm({ ...form, password: e.target.value })}
								placeholder="At least 8 characters"
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="new-admin-role">Role</Label>
							<RoleSelect
								id="new-admin-role"
								label="Role"
								value={form.role}
								onChange={(role) => setForm({ ...form, role })}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button type="button" onClick={() => void handleCreate()} disabled={loading}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Add admin
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
