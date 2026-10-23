/**
 * Sets a temporary password on the owner admin account (super_admin) and forces a
 * new password at first sign-in. Run once after migrating a fresh database, or to
 * recover the owner account. Revokes every existing owner session.
 *
 *   OWNER_TEMP_PASSWORD='a long random passphrase' npm run owner:set-temp-password
 *
 * Env (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * OWNER_TEMP_PASSWORD (required, never committed), OWNER_EMAIL (optional, defaults
 * to the seeded owner). Share the temporary password out of band, then sign in at
 * /admin/signin: the admin panel stays on Settings until the password is changed.
 */
import { config as loadEnv } from "dotenv";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { OWNER_EMAIL, temporaryPasswordProblem } from "../lib/adminOwner";

loadEnv({ path: ".env.local" });

async function main() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	const email = (process.env.OWNER_EMAIL || OWNER_EMAIL).trim().toLowerCase();
	const password = process.env.OWNER_TEMP_PASSWORD;

	if (!supabaseUrl || !serviceKey) {
		throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
	}
	const problem = temporaryPasswordProblem(password);
	if (problem || !password) throw new Error(problem ?? "OWNER_TEMP_PASSWORD is required.");

	const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
	const { data: owner, error } = await db
		.from("admin_users")
		.update({
			password_hash: await bcrypt.hash(password, 12),
			must_change_password: true,
			is_active: true,
			updated_at: new Date().toISOString(),
		})
		.eq("email", email)
		.eq("role", "super_admin")
		.select("id")
		.maybeSingle();

	if (error) throw new Error(`Failed to update the owner: ${error.message}`);
	if (!owner) {
		throw new Error(`No super_admin with email ${email}. Run the migrations first (20261024000101_seed_owner.sql).`);
	}

	await db
		.from("admin_sessions")
		.update({ revoked_at: new Date().toISOString() })
		.eq("admin_id", owner.id)
		.is("revoked_at", null);

	await db.from("admin_activity_log").insert({
		admin_id: owner.id,
		action: "owner_temp_password_set",
		target_type: "admin",
		target_id: owner.id,
		details: { source: "scripts/set-owner-password.ts" },
	});

	console.log(`Temporary password set for ${email}. A new password is required at first sign-in.`);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
