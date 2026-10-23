/**
 * Data retention limits. The database enforces them (pg_cron); these constants keep
 * the app copy in step. If you change one, change the SQL default too.
 */

/** Contact form messages: purge_old_contact_submissions() default, migration 20261024000300. */
export const CONTACT_RETENTION_MONTHS = 18;

export function contactRetentionNotice(months: number = CONTACT_RETENTION_MONTHS): string {
	return `Messages are deleted automatically ${months} months after they arrive.`;
}
