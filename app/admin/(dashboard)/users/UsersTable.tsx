"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Search,
	ChevronLeft,
	ChevronRight,
	CreditCard,
	Mail,
	MoreHorizontal,
	Infinity,
	Loader2,
	Trash,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface User {
	id: string;
	email: string;
	full_name: string | null;
	ai_credits: number;
	unlimited_access: boolean;
	unlimited_access_expires_at: string | null;
	can_change_email: boolean;
	created_at: string;
}

interface UsersTableProps {
	users: User[];
	total: number;
	page: number;
	totalPages: number;
}

export function UsersTable({ users, total, page, totalPages }: UsersTableProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [search, setSearch] = useState(searchParams.get("search") || "");
	const [loading, setLoading] = useState(false);

	// Credit modal state
	const [creditModalOpen, setCreditModalOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<User | null>(null);
	const [creditAction, setCreditAction] = useState<"add" | "unlimited">("add");
	const [creditAmount, setCreditAmount] = useState("10");
	const [unlimitedType, setUnlimitedType] = useState<"permanent" | "timed">("permanent");
	const [unlimitedDays, setUnlimitedDays] = useState("30");

	// Email modal state
	const [emailModalOpen, setEmailModalOpen] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [requireVerification, setRequireVerification] = useState(true);
	// Delete modal state
	const [deleteModalOpen, setDeleteModalOpen] = useState(false);
	const [userToDelete, setUserToDelete] = useState<User | null>(null);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		const params = new URLSearchParams(searchParams.toString());
		if (search) {
			params.set("search", search);
		} else {
			params.delete("search");
		}
		params.set("page", "1");
		router.push(`/admin/users?${params.toString()}`);
	};

	const handlePageChange = (newPage: number) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("page", newPage.toString());
		router.push(`/admin/users?${params.toString()}`);
	};

	const openCreditModal = (user: User) => {
		setSelectedUser(user);
		setCreditAction("add");
		setCreditAmount("10");
		setCreditModalOpen(true);
	};

	const openEmailModal = (user: User) => {
		setSelectedUser(user);
		setNewEmail("");
		setRequireVerification(true);
		setEmailModalOpen(true);
	};

	const openDeleteModal = (user: User) => {
		setUserToDelete(user);
		setDeleteModalOpen(true);
	};

	const handleCreditSubmit = async () => {
		if (!selectedUser) return;
		setLoading(true);

		try {
			const body: any = { userId: selectedUser.id };

			if (creditAction === "add") {
				body.action = "add_credits";
				body.amount = parseInt(creditAmount);
			} else {
				body.action = "set_unlimited";
				body.unlimited = true;
				if (unlimitedType === "timed") {
					const expiresAt = new Date();
					expiresAt.setDate(expiresAt.getDate() + parseInt(unlimitedDays));
					body.expiresAt = expiresAt.toISOString();
				}
			}

			const res = await fetch("/api/admin/users/credits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

			if (!res.ok) {
				throw new Error("Failed to update credits");
			}

			setCreditModalOpen(false);
			router.refresh();
		} catch (error) {
			console.error("Error updating credits:", error);
			alert("Failed to update credits");
		} finally {
			setLoading(false);
		}
	};

	const handleEmailChange = async () => {
		if (!selectedUser || !newEmail) return;
		setLoading(true);

		try {
			const res = await fetch("/api/admin/users/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: selectedUser.id,
					newEmail,
					requireVerification,
				}),
			});

			if (!res.ok) {
				throw new Error("Failed to change email");
			}

			setEmailModalOpen(false);
			router.refresh();
		} catch (error) {
			console.error("Error changing email:", error);
			alert("Failed to change email");
		} finally {
			setLoading(false);
		}
	};

	const toggleEmailPermission = async (user: User) => {
		setLoading(true);

		try {
			const res = await fetch("/api/admin/users/email-permission", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					canChangeEmail: !user.can_change_email,
				}),
			});

			if (!res.ok) {
				throw new Error("Failed to update permission");
			}

			router.refresh();
		} catch (error) {
			console.error("Error updating permission:", error);
			alert("Failed to update permission");
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteUser = async () => {
		if (!userToDelete) return;
		setLoading(true);

		try {
			const res = await fetch("/api/admin/users/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId: userToDelete.id }),
			});

			if (!res.ok) {
				throw new Error("Failed to delete user");
			}

			setDeleteModalOpen(false);
			router.refresh();
		} catch (error) {
			console.error("Error deleting user:", error);
			alert("Failed to delete user");
		} finally {
			setLoading(false);
		}
	};

	const revokeUnlimitedAccess = async (user: User) => {
		setLoading(true);

		try {
			const res = await fetch("/api/admin/users/credits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId: user.id,
					action: "set_unlimited",
					unlimited: false,
				}),
			});

			if (!res.ok) {
				throw new Error("Failed to revoke access");
			}

			router.refresh();
		} catch (error) {
			console.error("Error revoking access:", error);
			alert("Failed to revoke access");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			{/* Search */}
			<form onSubmit={handleSearch} className="flex gap-2">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by email or name..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Button type="submit">Search</Button>
			</form>

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Credits</TableHead>
							<TableHead>Email Permission</TableHead>
							<TableHead>Joined</TableHead>
							<TableHead className="w-[70px]">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
									No users found
								</TableCell>
							</TableRow>
						) : (
							users.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<div>
											<p className="font-medium">{user.full_name || "Unnamed"}</p>
											<p className="text-sm text-muted-foreground">{user.email}</p>
										</div>
									</TableCell>
									<TableCell>
										{user.unlimited_access ? (
											<Badge variant="success" className="gap-1">
												<Infinity className="h-3 w-3" />
												Unlimited
												{user.unlimited_access_expires_at && (
													<span className="text-xs">
														(until {new Date(user.unlimited_access_expires_at).toLocaleDateString()})
													</span>
												)}
											</Badge>
										) : (
											<Badge variant="secondary">{user.ai_credits ?? 2} credits</Badge>
										)}
									</TableCell>
									<TableCell>
										{user.can_change_email ? (
											<Badge variant="success">Can change</Badge>
										) : (
											<Badge variant="outline">Restricted</Badge>
										)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{new Date(user.created_at).toLocaleDateString()}
									</TableCell>
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button variant="ghost" size="icon">
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuLabel>Actions</DropdownMenuLabel>
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={() => openCreditModal(user)}>
													<CreditCard className="mr-2 h-4 w-4" />
													Manage Credits
												</DropdownMenuItem>
												{user.unlimited_access && (
													<DropdownMenuItem onClick={() => revokeUnlimitedAccess(user)}>
														<CreditCard className="mr-2 h-4 w-4" />
														Revoke Unlimited
													</DropdownMenuItem>
												)}
												<DropdownMenuSeparator />
												<DropdownMenuItem onClick={() => openEmailModal(user)}>
													<Mail className="mr-2 h-4 w-4" />
													Change Email
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => toggleEmailPermission(user)}>
													<Mail className="mr-2 h-4 w-4" />
													{user.can_change_email ? "Revoke" : "Grant"} Email Change
												</DropdownMenuItem>
												<DropdownMenuSeparator />
												<DropdownMenuItem
													className="text-destructive focus:text-destructive"
													onClick={() => openDeleteModal(user)}
												>
													<Trash className="mr-2 h-4 w-4" />
													Delete User
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<p className="text-sm text-muted-foreground">
					Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} users
				</p>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => handlePageChange(page - 1)}
						disabled={page <= 1}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handlePageChange(page + 1)}
						disabled={page >= totalPages}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Credit Management Modal */}
			<Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Manage Credits</DialogTitle>
						<DialogDescription>
							Update AI generation credits for {selectedUser?.full_name || selectedUser?.email}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Action</Label>
							<Select value={creditAction} onValueChange={(v: "add" | "unlimited") => setCreditAction(v)}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="add">Add Credits</SelectItem>
									<SelectItem value="unlimited">Grant Unlimited Access</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{creditAction === "add" ? (
							<div className="space-y-2">
								<Label>Credits to Add</Label>
								<Input
									type="number"
									min="1"
									value={creditAmount}
									onChange={(e) => setCreditAmount(e.target.value)}
								/>
							</div>
						) : (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label>Duration</Label>
									<Select value={unlimitedType} onValueChange={(v: "permanent" | "timed") => setUnlimitedType(v)}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="permanent">Permanent</SelectItem>
											<SelectItem value="timed">Time-limited</SelectItem>
										</SelectContent>
									</Select>
								</div>
								{unlimitedType === "timed" && (
									<div className="space-y-2">
										<Label>Days</Label>
										<Input
											type="number"
											min="1"
											value={unlimitedDays}
											onChange={(e) => setUnlimitedDays(e.target.value)}
										/>
									</div>
								)}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreditModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCreditSubmit} disabled={loading}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Email Change Modal */}
			<Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Change User Email</DialogTitle>
						<DialogDescription>
							Change email for {selectedUser?.full_name || selectedUser?.email}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Current Email</Label>
							<Input value={selectedUser?.email || ""} disabled />
						</div>
						<div className="space-y-2">
							<Label>New Email</Label>
							<Input
								type="email"
								placeholder="new@email.com"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
							/>
						</div>
						<div className="flex items-center gap-2">
							<input
								type="checkbox"
								id="requireVerification"
								checked={requireVerification}
								onChange={(e) => setRequireVerification(e.target.checked)}
								className="rounded border-gray-300"
							/>
							<Label htmlFor="requireVerification" className="text-sm font-normal">
								Require email verification
							</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEmailModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleEmailChange} disabled={loading || !newEmail}>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Change Email
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete User Modal */}
			<Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete User</DialogTitle>
						<DialogDescription>
							This will remove the user and their account access. This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2 py-2">
						<p className="text-sm">
							User: <span className="font-medium">{userToDelete?.full_name || "Unnamed"}</span>
						</p>
						<p className="text-sm text-muted-foreground">{userToDelete?.email}</p>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteModalOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeleteUser}
							disabled={loading}
						>
							{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Delete User
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
