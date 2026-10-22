import { describe, expect, it } from "vitest";
import { createAdminSessionToken, hashAdminSessionToken } from "@/lib/adminSessionToken";

describe("admin session tokens", () => {
	it("creates distinct high-entropy opaque tokens", () => {
		const first = createAdminSessionToken();
		const second = createAdminSessionToken();
		expect(first).not.toBe(second);
		expect(first.length).toBeGreaterThanOrEqual(43);
		expect(first).not.toMatch(/^[0-9a-f-]{36}$/i);
	});

	it("does not make an admin UUID a valid stored token hash", () => {
		const adminId = "11111111-1111-4111-8111-111111111111";
		const realToken = createAdminSessionToken();
		expect(hashAdminSessionToken(adminId)).not.toBe(hashAdminSessionToken(realToken));
		expect(hashAdminSessionToken(realToken)).toMatch(/^[0-9a-f]{64}$/);
	});
});
