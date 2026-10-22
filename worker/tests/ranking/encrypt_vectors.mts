/// <reference types="node" />

// Generates cross-language test vectors with the app's real lib/encryption.ts.
// Usage (Node >= 23, which strips TS types natively):
//   node worker/tests/ranking/encrypt_vectors.mts "$PWD/lib/encryption.ts" > worker/tests/ranking/fixtures/encryption_vectors.json
// test_secrets.py decrypts the stored vectors in Python, and (when node is on
// PATH) also runs this script live and decrypts its fresh output.
const mod = await import(process.argv[2]);

const cases = [
	{ env: { ENCRYPTION_KEY: "test-encryption-key-0123456789abcdef-extra" }, plaintext: "sk-ant-test-1234567890" },
	{ env: { ENCRYPTION_KEY: "test-encryption-key-0123456789abcdef-extra" }, plaintext: "sk-proj-ünïcødé-key ✓" },
	{ env: { SUPABASE_JWT_SECRET: "super-secret-jwt-token-with-at-least-32-characters-long" }, plaintext: "gsk_groq_test_key" },
];

const out: unknown[] = [];
for (const c of cases) {
	delete process.env.ENCRYPTION_KEY;
	delete process.env.SUPABASE_JWT_SECRET;
	Object.assign(process.env, c.env);
	const ciphertext = mod.encryptApiKey(c.plaintext);
	if (mod.decryptApiKey(ciphertext) !== c.plaintext) throw new Error("node roundtrip failed");
	out.push({ env: c.env, plaintext: c.plaintext, ciphertext });
}
console.log(JSON.stringify(out, null, 2));
