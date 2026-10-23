/** IANA time zone helpers shared by the Settings form and the /api/onboarding schema. */

export const DEFAULT_PROFILE_TIME_ZONE = "America/New_York";

/** US zones listed first in the picker (US-first product). */
export const US_TIME_ZONES = [
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Phoenix",
	"America/Los_Angeles",
	"America/Anchorage",
	"Pacific/Honolulu",
] as const;

// "Area/Location[/Sub]" or "UTC". Rejects offsets such as "+05:30" (Postgres reads POSIX
// offsets with the opposite sign) and abbreviations such as "EST".
const IANA_NAME = /^(?:UTC|[A-Z][A-Za-z_]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;

/**
 * The canonical spelling of an IANA zone the runtime knows (e.g. "america/chicago" →
 * "America/Chicago"), or null for anything else.
 */
export function canonicalTimeZone(value: string): string | null {
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > 64) return null;
	try {
		const resolved = new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).resolvedOptions().timeZone;
		return IANA_NAME.test(resolved) ? resolved : null;
	} catch {
		return null;
	}
}

/** Every zone the runtime supports, US zones first, always including `current`. */
export function timeZoneOptions(current: string | null | undefined): string[] {
	const supported =
		typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [...US_TIME_ZONES];
	const rest = supported.filter((zone) => !(US_TIME_ZONES as readonly string[]).includes(zone));
	const options = [...US_TIME_ZONES, ...rest];
	if (current && !options.includes(current)) options.unshift(current);
	return options;
}
