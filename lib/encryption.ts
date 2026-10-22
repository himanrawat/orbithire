import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from environment
 * Falls back to a derived key from SUPABASE_JWT_SECRET if ENCRYPTION_KEY not set
 */
function getEncryptionKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;

	if (key && key.length >= 32) {
		// Use first 32 bytes of the key
		return Buffer.from(key.slice(0, 32), "utf-8");
	}

	// Fallback: derive from SUPABASE_JWT_SECRET
	const fallbackSecret = process.env.SUPABASE_JWT_SECRET;
	if (fallbackSecret) {
		return scryptSync(fallbackSecret, "api-key-encryption", KEY_LENGTH);
	}

	throw new Error("ENCRYPTION_KEY or SUPABASE_JWT_SECRET must be set for API key encryption");
}

/**
 * Encrypt a plaintext string (e.g., API key)
 * Returns base64-encoded string: salt:iv:tag:ciphertext
 */
export function encryptApiKey(plaintext: string): string {
	if (!plaintext) return "";

	const key = getEncryptionKey();
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);

	// Derive a unique key for this encryption using salt
	const derivedKey = scryptSync(new Uint8Array(key), new Uint8Array(salt), KEY_LENGTH);

	const cipher = createCipheriv(
		ALGORITHM,
		new Uint8Array(derivedKey),
		new Uint8Array(iv)
	);

	let encrypted = cipher.update(plaintext, "utf-8", "hex");
	encrypted += cipher.final("hex");

	const tag = cipher.getAuthTag();

	// Combine: salt + iv + tag + ciphertext (all as hex, separated by colons)
	return `${salt.toString("hex")}:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted API key
 * Expects format: salt:iv:tag:ciphertext (hex-encoded, colon-separated)
 */
export function decryptApiKey(encrypted: string): string {
	if (!encrypted) return "";

	// Check if it's already plaintext (legacy data without colons)
	if (!encrypted.includes(":")) {
		// Return as-is for backward compatibility with unencrypted keys
		return encrypted;
	}

	const key = getEncryptionKey();

	const parts = encrypted.split(":");
	if (parts.length !== 4) {
		// Invalid format, might be legacy plaintext
		return encrypted;
	}

	const [saltHex, ivHex, tagHex, ciphertext] = parts;

	try {
		const salt = Buffer.from(saltHex, "hex");
		const iv = Buffer.from(ivHex, "hex");
		const tag = Buffer.from(tagHex, "hex");

		// Derive the same key using the stored salt
		const derivedKey = scryptSync(
			new Uint8Array(key),
			new Uint8Array(salt),
			KEY_LENGTH
		);

		const decipher = createDecipheriv(
			ALGORITHM,
			new Uint8Array(derivedKey),
			new Uint8Array(iv)
		);
		decipher.setAuthTag(new Uint8Array(tag));

		let decrypted = decipher.update(ciphertext, "hex", "utf-8");
		decrypted += decipher.final("utf-8");

		return decrypted;
	} catch (error) {
		console.error("Failed to decrypt API key:", error);
		// Return as-is if decryption fails (might be legacy plaintext)
		return encrypted;
	}
}

/**
 * Check if a string appears to be encrypted (has our format)
 */
export function isEncrypted(value: string): boolean {
	if (!value) return false;
	const parts = value.split(":");
	return parts.length === 4 && parts.every(p => /^[0-9a-f]+$/i.test(p));
}
