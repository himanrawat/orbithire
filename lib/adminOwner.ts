// The owner account seeded by 20261024000101_seed_owner.sql, and the rules for the
// temporary password scripts/set-owner-password.ts sets on it.

export const OWNER_EMAIL = "hello@himanshurawat.in";
export const TEMP_PASSWORD_MIN_LENGTH = 12;

// Returns a reason the temporary password is unacceptable, or null when it's fine.
export function temporaryPasswordProblem(password: string | undefined): string | null {
	if (!password) return "Set OWNER_TEMP_PASSWORD to the temporary password.";
	if (password.length < TEMP_PASSWORD_MIN_LENGTH) {
		return `OWNER_TEMP_PASSWORD must be at least ${TEMP_PASSWORD_MIN_LENGTH} characters.`;
	}
	if (password.length > 256) return "OWNER_TEMP_PASSWORD must be at most 256 characters.";
	if (new Set(password).size < 6) return "OWNER_TEMP_PASSWORD is too repetitive.";
	return null;
}
