import { requireAdminPage } from "@/lib/adminAuth";

// The page is a client component, so its role check lives in this segment layout.
export default async function AccessCodesLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	await requireAdminPage("admin");
	return <>{children}</>;
}
