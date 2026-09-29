import assert from "node:assert/strict";
import { test } from "node:test";

import netRevenue from "../agent/tools/compute_net_revenue.ts";
import restockAmount from "../agent/tools/compute_restock_amount.ts";
import stockoutRisk from "../agent/tools/estimate_stockout_risk.ts";

function run(tool, input) {
  const result = tool.execute(tool.inputSchema.parse(input));
  return tool.outputSchema.parse(result);
}

test("net revenue subtracts refunds and can be negative", () => {
  assert.deepEqual(
    run(netRevenue, { salesMinor: 100_00, refundsMinor: 12_00, currency: "USD" }),
    { currency: "USD", netRevenueMinor: 88_00 },
  );
  assert.equal(
    run(netRevenue, { salesMinor: 100, refundsMinor: 200, currency: "USD" }).netRevenueMinor,
    -100,
  );
  assert.throws(() => netRevenue.inputSchema.parse({ salesMinor: -1, refundsMinor: 0, currency: "USD" }));
  assert.throws(() => netRevenue.inputSchema.parse({ salesMinor: 1.5, refundsMinor: 0, currency: "USD" }));
});

test("restock rounds projected demand up and subtracts available stock", () => {
  const input = {
    unitsSold: 28,
    lookbackDays: 7,
    sellableOnHand: 15,
    inboundUnits: 10,
    leadTimeDays: 10,
    reviewPeriodDays: 7,
    safetyStockUnits: 20,
  };
  assert.deepEqual(run(restockAmount, input), {
    projectedDemandUnits: 68,
    targetStockUnits: 88,
    restockUnits: 63,
  });
  assert.equal(run(restockAmount, { ...input, sellableOnHand: 200 }).restockUnits, 0);
  assert.equal(
    run(restockAmount, {
      ...input,
      unitsSold: 1,
      lookbackDays: 3,
      leadTimeDays: 1,
      reviewPeriodDays: 0,
      sellableOnHand: 0,
      inboundUnits: 0,
      safetyStockUnits: 0,
    }).restockUnits,
    1,
  );
  assert.throws(() => restockAmount.inputSchema.parse({ ...input, lookbackDays: 0 }));
  assert.throws(
    () => run(restockAmount, { ...input, unitsSold: Number.MAX_SAFE_INTEGER, lookbackDays: 1 }),
    RangeError,
  );
});

test("stockout risk handles lead time, no recent demand, and empty shelves", () => {
  const input = { unitsSold: 28, lookbackDays: 7, sellableOnHand: 15, leadTimeDays: 10 };
  assert.deepEqual(run(stockoutRisk, input), {
    averageDailyUnitsSold: 4,
    daysUntilStockout: 3.75,
    status: "reorder_now",
  });
  assert.equal(run(stockoutRisk, { ...input, leadTimeDays: 3 }).status, "sufficient_for_lead_time");
  assert.deepEqual(run(stockoutRisk, { ...input, unitsSold: 0 }), {
    averageDailyUnitsSold: 0,
    daysUntilStockout: null,
    status: "no_recent_sales",
  });
  assert.equal(run(stockoutRisk, { ...input, sellableOnHand: 0 }).status, "out_of_stock");
  assert.throws(() => stockoutRisk.inputSchema.parse({ ...input, lookbackDays: 0 }));
});
