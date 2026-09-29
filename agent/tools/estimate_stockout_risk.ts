import { defineTool } from "eve/tools";
import { z } from "zod";

const units = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const days = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export default defineTool({
  description:
    "Estimate days until a product runs out of sellable stock at its recent sales rate and whether it could run out before a new order arrives. Does not account for incoming stock or changing demand.",
  inputSchema: z.object({
    unitsSold: units.describe("Units sold during the lookback period."),
    lookbackDays: days.positive().describe("Number of days in the sales lookback period."),
    sellableOnHand: units.describe("Sellable, unreserved units currently on hand."),
    leadTimeDays: days.describe("Days until a new order is available for sale."),
  }),
  outputSchema: z.object({
    averageDailyUnitsSold: z.number().nonnegative(),
    daysUntilStockout: z.number().nonnegative().nullable(),
    status: z.enum([
      "out_of_stock",
      "no_recent_sales",
      "reorder_now",
      "sufficient_for_lead_time",
    ]),
  }),
  execute({ unitsSold, lookbackDays, sellableOnHand, leadTimeDays }) {
    const averageDailyUnitsSold = unitsSold / lookbackDays;

    if (sellableOnHand === 0) {
      return { averageDailyUnitsSold, daysUntilStockout: 0, status: "out_of_stock" as const };
    }
    if (unitsSold === 0) {
      return { averageDailyUnitsSold, daysUntilStockout: null, status: "no_recent_sales" as const };
    }

    const daysUntilStockout = sellableOnHand / averageDailyUnitsSold;
    return {
      averageDailyUnitsSold,
      daysUntilStockout,
      status:
        daysUntilStockout <= leadTimeDays
          ? ("reorder_now" as const)
          : ("sufficient_for_lead_time" as const),
    };
  },
});
