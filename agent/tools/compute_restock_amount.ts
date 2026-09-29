import { defineTool } from "eve/tools";
import { z } from "zod";

const units = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const days = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export default defineTool({
  description:
    "Recommend units to reorder from recent unit sales, supplier lead time, review period, safety stock, sellable stock on hand, and inbound units due before the coverage period ends. Assumes the lookback sales rate continues; does not place an order.",
  inputSchema: z.object({
    unitsSold: units.describe("Units sold during the lookback period."),
    lookbackDays: days.positive().describe("Number of days in the sales lookback period."),
    sellableOnHand: units.describe("Sellable, unreserved units currently on hand."),
    inboundUnits: units.describe("Units due to arrive before the end of the coverage period."),
    leadTimeDays: days.describe("Days until a new order is available for sale."),
    reviewPeriodDays: days.describe("Days between inventory reviews or orders."),
    safetyStockUnits: units.describe("Additional units to keep as a safety buffer."),
  }),
  outputSchema: z.object({
    projectedDemandUnits: units,
    targetStockUnits: units,
    restockUnits: units,
  }),
  execute({
    unitsSold,
    lookbackDays,
    sellableOnHand,
    inboundUnits,
    leadTimeDays,
    reviewPeriodDays,
    safetyStockUnits,
  }) {
    const coverageDays = BigInt(leadTimeDays) + BigInt(reviewPeriodDays);
    const projectedDemand =
      (BigInt(unitsSold) * coverageDays + BigInt(lookbackDays) - 1n) / BigInt(lookbackDays);
    const targetStock = projectedDemand + BigInt(safetyStockUnits);
    if (targetStock > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new RangeError("Stock target exceeds the safe integer range");
    }

    const needed = targetStock - BigInt(sellableOnHand) - BigInt(inboundUnits);
    return {
      projectedDemandUnits: Number(projectedDemand),
      targetStockUnits: Number(targetStock),
      restockUnits: Number(needed > 0n ? needed : 0n),
    };
  },
});
