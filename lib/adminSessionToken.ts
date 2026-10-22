import { createHash, randomBytes } from "crypto";

export function createAdminSessionToken() {
	return randomBytes(32).toString("base64url");
}

export function hashAdminSessionToken(token: string) {
	return createHash("sha256").update(token).digest("hex");
}
