"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Plus, Copy, Trash2, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";

interface AccessCode {
	id: string;
	code: string;
	used_by: string | null;
	used_at: string | null;
	expires_at: string | null;
	is_active: boolean;
	created_at: string;
}

export default function AccessCodesPage() {
	const router = useRouter();
	const [codes, setCodes] = useState<AccessCode[]>([]);
	const [loading, setLoading] = useState(true);
	const [creating, setCreating] = useState(false);
	const [expiresInDays, setExpiresInDays] = useState("30");
	const [copiedId, setCopiedId] = useState<string | null>(null);

	useEffect(() => {
		fetchCodes();
	}, []);

	const fetchCodes = async () => {
		try {
			const res = await fetch("/api/admin/access-codes");
			if (res.ok) {
				const data = await res.json();
				setCodes(data.codes);
			}
		} catch (error) {
			console.error("Error fetching codes:", error);
		} finally {
			setLoading(false);
		}
	};

	const createCode = async () => {
		setCreating(true);
		try {
			const res = await fetch("/api/admin/access-codes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expiresInDays: parseInt(expiresInDays) }),
			});

			if (res.ok) {
				fetchCodes();
			}
		} catch (error) {
			console.error("Error creating code:", error);
		} finally {
			setCreating(false);
		}
	};

	const deleteCode = async (codeId: string) => {
		try {
			const res = await fetch(`/api/admin/access-codes?id=${codeId}`, {
				method: "DELETE",
			});

			if (res.ok) {
				fetchCodes();
			}
		} catch (error) {
			console.error("Error deleting code:", error);
		}
	};

	const copyCode = (code: string, id: string) => {
		navigator.clipboard.writeText(code);
		setCopiedId(id);
		setTimeout(() => setCopiedId(null), 2000);
	};

	return (
		<div className="space-y-6">
			<PageHeader title="Access codes" description="Manage admin registration access codes." className="mb-0" />

			{/* Create new code */}
			<Card>
				<CardHeader>
					<CardTitle>Create Access Code</CardTitle>
					<CardDescription>
						Generate a new access code for admin registration.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex gap-4 items-end">
						<div className="space-y-2">
							<Label>Expires in (days)</Label>
							<Input
								type="number"
								min="1"
								value={expiresInDays}
								onChange={(e) => setExpiresInDays(e.target.value)}
								className="w-32"
							/>
						</div>
						<Button onClick={createCode} disabled={creating}>
							{creating ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Plus className="mr-2 h-4 w-4" />
							)}
							Generate Code
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Codes list */}
			<Card>
				<CardHeader>
					<CardTitle>Existing Codes</CardTitle>
					<CardDescription>
						All access codes and their status.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					) : codes.length === 0 ? (
						<p className="text-center py-8 text-muted-foreground">
							No access codes yet. Create one above.
						</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Code</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="w-[100px]">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{codes.map((code) => (
									<TableRow key={code.id}>
										<TableCell className="font-mono">{code.code}</TableCell>
										<TableCell>
											{code.used_by ? (
												<Badge variant="secondary">Used</Badge>
											) : !code.is_active ? (
												<Badge variant="destructive">Inactive</Badge>
											) : code.expires_at && new Date(code.expires_at) < new Date() ? (
												<Badge variant="destructive">Expired</Badge>
											) : (
												<Badge variant="success">Active</Badge>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{code.expires_at
												? new Date(code.expires_at).toLocaleDateString()
												: "Never"}
										</TableCell>
										<TableCell className="text-muted-foreground">
											{new Date(code.created_at).toLocaleDateString()}
										</TableCell>
										<TableCell>
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="icon"
													onClick={() => copyCode(code.code, code.id)}
													disabled={!!code.used_by}
												>
													{copiedId === code.id ? (
														<Check className="h-4 w-4 text-[var(--success)]" />
													) : (
														<Copy className="h-4 w-4" />
													)}
												</Button>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => deleteCode(code.id)}
													disabled={!!code.used_by}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
