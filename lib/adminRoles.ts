// Admin roles, ranked. `super_admin` is the single owner account; `admin` runs the
// product; `moderator` only sees the moderation queue and the contact inbox.
// Pure helpers so the sidebar, pages, routes and tests share one source of truth.

export const ADMIN_ROLES = ["moderator", "admin", "super_admin"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

// Roles the owner can hand out. There is only ever one owner.
export const ASSIGNABLE_ADMIN_ROLES = ["admin", "moderator"] as const;
export type AssignableAdminRole = (typeof ASSIGNABLE_ADMIN_ROLES)[number];

const ROLE_RANK: Record<AdminRole, number> = {
	moderator: 1,
	admin: 2,
	super_admin: 3,
};

const ROLE_LABEL: Record<AdminRole, string> = {
	moderator: "Moderator",
	admin: "Admin",
	super_admin: "Owner",
};

export const ADMIN_SETTINGS_PATH = "/admin/settings";

// Minimum role per admin page. Anything not listed here needs `admin`.
const PAGE_MIN_ROLE: Record<string, AdminRole> = {
	"/admin/moderation": "moderator",
	"/admin/contacts": "moderator",
	"/admin/settings": "moderator",
	"/admin/admins": "super_admin",
};

export function isAdminRole(value: unknown): value is AdminRole {
	return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export function hasMinRole(role: AdminRole, minRole: AdminRole) {
	return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export function adminRoleLabel(role: AdminRole) {
	return ROLE_LABEL[role];
}

export function adminPageMinRole(path: string): AdminRole {
	const match = Object.keys(PAGE_MIN_ROLE).find(
		(prefix) => path === prefix || path.startsWith(`${prefix}/`)
	);
	return match ? PAGE_MIN_ROLE[match] : "admin";
}

export function canAccessAdminPath(role: AdminRole, path: string) {
	return hasMinRole(role, adminPageMinRole(path));
}

// Where an admin lands after sign-in, or when a page is above their role.
export function adminHomePath(role: AdminRole, mustChangePassword: boolean) {
	if (mustChangePassword) return ADMIN_SETTINGS_PATH;
	if (role === "moderator") return "/admin/moderation";
	return "/admin/dashboard";
}

// Only follow same-origin admin paths returned by the sign-in API.
export function safeAdminRedirect(value: unknown) {
	if (typeof value === "string" && value.startsWith("/admin/") && !value.includes("//")) {
		return value;
	}
	return "/admin/dashboard";
}
