import { describe, expect, it } from "vitest";
import {
	adminHomePath,
	adminPageMinRole,
	adminRoleLabel,
	canAccessAdminPath,
	hasMinRole,
	isAdminRole,
	safeAdminRedirect,
} from "@/lib/adminRoles";
import { adminActionSchema } from "@/lib/schemas/admin";

describe("admin roles", () => {
	it("ranks owner above admin above moderator", () => {
		expect(hasMinRole("super_admin", "admin")).toBe(true);
		expect(hasMinRole("admin", "moderator")).toBe(true);
		expect(hasMinRole("moderator", "admin")).toBe(false);
		expect(hasMinRole("admin", "super_admin")).toBe(false);
		expect(hasMinRole("moderator", "moderator")).toBe(true);
	});

	it("recognizes only known roles", () => {
		expect(isAdminRole("moderator")).toBe(true);
		expect(isAdminRole("owner")).toBe(false);
		expect(isAdminRole(null)).toBe(false);
	});

	it("labels the super admin as the owner", () => {
		expect(adminRoleLabel("super_admin")).toBe("Owner");
	});

	it("limits moderators to moderation, contacts and their own settings", () => {
		expect(canAccessAdminPath("moderator", "/admin/moderation")).toBe(true);
		expect(canAccessAdminPath("moderator", "/admin/contacts")).toBe(true);
		expect(canAccessAdminPath("moderator", "/admin/settings")).toBe(true);
		expect(canAccessAdminPath("moderator", "/admin/users")).toBe(false);
		expect(canAccessAdminPath("moderator", "/admin/dashboard")).toBe(false);
	});

	it("keeps admin management for the owner and defaults unknown pages to admin", () => {
		expect(canAccessAdminPath("admin", "/admin/admins")).toBe(false);
		expect(canAccessAdminPath("super_admin", "/admin/admins")).toBe(true);
		expect(adminPageMinRole("/admin/some-new-page")).toBe("admin");
		expect(adminPageMinRole("/admin/contactsx")).toBe("admin");
	});

	it("sends temporary-password admins to settings first", () => {
		expect(adminHomePath("super_admin", true)).toBe("/admin/settings");
		expect(adminHomePath("moderator", false)).toBe("/admin/moderation");
		expect(adminHomePath("admin", false)).toBe("/admin/dashboard");
	});

	it("only follows same-origin admin redirects", () => {
		expect(safeAdminRedirect("/admin/settings")).toBe("/admin/settings");
		expect(safeAdminRedirect("https://evil.example/admin/")).toBe("/admin/dashboard");
		expect(safeAdminRedirect("/admin//evil.example")).toBe("/admin/dashboard");
		expect(safeAdminRedirect(undefined)).toBe("/admin/dashboard");
	});
});

describe("admin action schema", () => {
	const adminId = "11111111-1111-4111-8111-111111111111";

	it("accepts admin and moderator role changes", () => {
		expect(adminActionSchema.safeParse({ action: "set_role", adminId, role: "moderator" }).success).toBe(true);
	});

	it("never assigns the owner role through the API", () => {
		expect(adminActionSchema.safeParse({ action: "set_role", adminId, role: "super_admin" }).success).toBe(false);
		const create = adminActionSchema.safeParse({
			action: "create",
			name: "Jordan Lee",
			email: "jordan@example.com",
			password: "longenough",
			role: "super_admin",
		});
		expect(create.success).toBe(false);
	});
});
