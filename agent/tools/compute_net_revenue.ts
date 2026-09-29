import { defineTool } from "eve/tools";
import { z } from "zod";

const minorUnits = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export default defineTool({
  description:
    "Compute net revenue from completed sales minus refunds for the same reporting period and currency. Supply both amounts in currency minor units (for example, USD cents) with the same tax and shipping treatment. A negative result is possible.",
  inputSchema: z.object({
    salesMinor: minorUnits.describe("Completed sales total in currency minor units."),
    refundsMinor: minorUnits.describe("Refunded amount in the same currency minor units."),
    currency: z.string().regex(/^[A-Z]{3}$/).describe("ISO 4217 currency code, such as USD."),
  }),
  outputSchema: z.object({
    currency: z.string(),
    netRevenueMinor: z.number().int(),
  }),
  execute({ salesMinor, refundsMinor, currency }) {
    return { currency, netRevenueMinor: salesMinor - refundsMinor };
  },
});
