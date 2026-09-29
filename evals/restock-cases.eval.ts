import { defineEval } from "eve/evals";

// Feature: dataset fan-out. Keep small fixtures inline; larger datasets can
// be loaded with loadJson/loadYaml from eve/evals/loaders instead.
const standardInput = {
  unitsSold: 28,
  lookbackDays: 7,
  sellableOnHand: 15,
  inboundUnits: 10,
  leadTimeDays: 10,
  reviewPeriodDays: 7,
  safetyStockUnits: 20,
};

const cases = [
  {
    description: "Normal reorder: demand and safety stock exceed available units.",
    input: standardInput,
    expected: { projectedDemandUnits: 68, targetStockUnits: 88, restockUnits: 63 },
  },
  {
    description: "Ample stock: never recommend a negative reorder quantity.",
    input: { ...standardInput, sellableOnHand: 200 },
    expected: { projectedDemandUnits: 68, targetStockUnits: 88, restockUnits: 0 },
  },
  {
    description: "Fractional demand: round up to a whole unit.",
    input: {
      unitsSold: 1,
      lookbackDays: 3,
      sellableOnHand: 0,
      inboundUnits: 0,
      leadTimeDays: 1,
      reviewPeriodDays: 0,
      safetyStockUnits: 0,
    },
    expected: { projectedDemandUnits: 1, targetStockUnits: 1, restockUnits: 1 },
  },
];

// An array export creates three independently scored evals, not three checks
// in a single session. Ids are restock-cases/0000, /0001, and /0002 in this order.
// Run just this dataset with: npm run eval -- restock-cases
export default cases.map(({ description, input, expected }) =>
  defineEval({
    description,
    tags: ["deterministic", "dataset"],
    async test(t) {
      await t.send(
        `Use the restock calculator for a product with ${input.unitsSold} units ` +
          `sold over ${input.lookbackDays} days, ${input.sellableOnHand} sellable ` +
          `unreserved units on hand, and ${input.inboundUnits} inbound units due ` +
          `before the coverage period ends. Supplier lead time is ${input.leadTimeDays} ` +
          `days, the review period is ${input.reviewPeriodDays} days, and safety ` +
          `stock is ${input.safetyStockUnits} units. Use only these figures; do not ` +
          "query the store or place an order.",
      );

      t.succeeded();
      // Expected values are fixed fixtures, not recalculated using the tool's
      // implementation: each dataset row has its own independent reference.
      t.calledTool("compute_restock_amount", { input, output: expected, count: 1 });
      t.noFailedActions();
    },
  }),
);
