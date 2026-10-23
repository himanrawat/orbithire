import { z } from "zod";
import { BILLING_INTERVALS } from "./prices";

/** POST /api/billing/checkout. The renewal-terms box must be ticked (it starts unchecked). */
export const checkoutSchema = z
	.object({
		interval: z.enum(BILLING_INTERVALS),
		acceptRenewalTerms: z.literal(true, {
			errorMap: () => ({ message: "Please agree to the automatic renewal terms." }),
		}),
	})
	.strict();

/** POST /api/billing/cancel. `resume: true` undoes a pending cancel before the period ends. */
export const cancelSchema = z
	.object({
		resume: z.boolean().optional(),
	})
	.strict();
