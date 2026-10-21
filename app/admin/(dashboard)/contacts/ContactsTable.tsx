"use client";

import { LocalDate } from "@/components/LocalDate";
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
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	ChevronLeft,
	ChevronRight,
	Eye,
	Mail,
	Loader2,
	Archive,
	CheckCircle,
	MessageSquare,
} from "lucide-react";

interface Contact {
	id: string;
	name: string;
	email: string;
	subject: string;
	message: string;
	status: "new" | "read" | "replied" | "archived";
	created_at: string;
}

interface ContactsTableProps {
	contacts: Contact[];
	total: number;
	page: number;
	totalPages: number;
}

const statusColors = {
	new: "default",
	read: "secondary",
	replied: "success",
	archived: "outline",
} as const;

export function ContactsTable({ contacts, total, page, totalPages }: ContactsTableProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [loading, setLoading] = useState(false);

	// View modal state
	const [viewModalOpen, setViewModalOpen] = useState(false);
	const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

	const handleFilterChange = (status: string) => {
		const params = new URLSearchParams(searchParams.toString());
		if (status === "all") {
			params.delete("status");
		} else {
			params.set("status", status);
		}
		params.set("page", "1");
		router.push(`/admin/contacts?${params.toString()}`);
	};

	const handlePageChange = (newPage: number) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("page", newPage.toString());
		router.push(`/admin/contacts?${params.toString()}`);
	};

	const openViewModal = async (contact: Contact) => {
		setSelectedContact(contact);
		setViewModalOpen(true);

		// Mark as read if it's new
		if (contact.status === "new") {
			await updateStatus(contact.id, "read");
		}
	};

	const updateStatus = async (contactId: string, newStatus: string) => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/contacts/status", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contactId, status: newStatus }),
			});

			if (!res.ok) {
				throw new Error("Failed to update status");
			}

			router.refresh();
		} catch (error) {
			console.error("Error updating status:", error);
		} finally {
			setLoading(false);
		}
	};

	const currentStatus = searchParams.get("status") || "all";

	return (
		<>
			{/* Filters */}
			<div className="flex gap-4 items-center">
				<Select value={currentStatus} onValueChange={handleFilterChange}>
					<SelectTrigger className="w-[180px]">
						<SelectValue placeholder="Filter by status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Messages</SelectItem>
						<SelectItem value="new">New</SelectItem>
						<SelectItem value="read">Read</SelectItem>
						<SelectItem value="replied">Replied</SelectItem>
						<SelectItem value="archived">Archived</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>From</TableHead>
							<TableHead>Subject</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Date</TableHead>
							<TableHead className="w-[100px]">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{contacts.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
									No contact submissions found
								</TableCell>
							</TableRow>
						) : (
							contacts.map((contact) => (
								<TableRow key={contact.id}>
									<TableCell>
										<div>
											<p className="font-medium">{contact.name}</p>
											<p className="text-sm text-muted-foreground">{contact.email}</p>
										</div>
									</TableCell>
									<TableCell className="max-w-[300px] truncate">
										{contact.subject}
									</TableCell>
									<TableCell>
										<Badge variant={statusColors[contact.status]}>
											{contact.status}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground">
										<LocalDate value={contact.created_at} />
									</TableCell>
									<TableCell>
										<div className="flex gap-1">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => openViewModal(contact)}
											>
												<Eye className="h-4 w-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => window.open(`mailto:${contact.email}?subject=Re: ${contact.subject}`)}
											>
												<Mail className="h-4 w-4" />
											</Button>
										</div>
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
					Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, total)} of {total} messages
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

			{/* View Modal */}
			<Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>{selectedContact?.subject}</DialogTitle>
						<DialogDescription>
							From {selectedContact?.name} ({selectedContact?.email}) on{" "}
							{selectedContact && new Date(selectedContact.created_at).toLocaleString()}
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<div className="rounded-lg bg-muted p-4">
							<p className="whitespace-pre-wrap">{selectedContact?.message}</p>
						</div>
					</div>
					<DialogFooter className="flex-col sm:flex-row gap-2">
						<div className="flex gap-2 flex-1">
							<Button
								variant="outline"
								size="sm"
								onClick={() => selectedContact && updateStatus(selectedContact.id, "replied")}
								disabled={loading || selectedContact?.status === "replied"}
							>
								{loading ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<CheckCircle className="mr-2 h-4 w-4" />
								)}
								Mark as Replied
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => selectedContact && updateStatus(selectedContact.id, "archived")}
								disabled={loading || selectedContact?.status === "archived"}
							>
								{loading ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<Archive className="mr-2 h-4 w-4" />
								)}
								Archive
							</Button>
						</div>
						<Button
							onClick={() => window.open(`mailto:${selectedContact?.email}?subject=Re: ${selectedContact?.subject}`)}
						>
							<MessageSquare className="mr-2 h-4 w-4" />
							Reply via Email
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
