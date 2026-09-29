import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

// Feature: multi-turn sessions and scoped assertions. A follow-up should reuse
// the conversation's figures, not create a fresh session or invent new inputs.
export default defineEval({
  description: "Multi-turn: carry stockout inputs into a restock recommendation.",
  tags: ["deterministic", "multi-turn"],
  async test(t) {
    const first = await t.send(
      "Use the stockout-risk calculator for a product that sold 28 units over " +
        "7 days, has 15 sellable unreserved units on hand, and has a supplier " +
        "lead time of 10 days. Use only these figures; do not query the store " +
        "or change records.",
    );

    // Turn assertions cannot be satisfied by a call in a later response.
    first.succeeded();
    first.calledTool("estimate_stockout_risk", {
      input: { unitsSold: 28, lookbackDays: 7, sellableOnHand: 15, leadTimeDays: 10 },
      output: {
        averageDailyUnitsSold: 4,
        daysUntilStockout: 3.75,
        status: "reorder_now",
      },
      count: 1,
    });
    first.notCalledTool("compute_restock_amount");

    // t.send() would create a NEW session. Continue through first.session so
    // the sales history, on-hand stock, and lead time remain in context.
    const second = await first.session.send(
      "Now use the restock calculator with the same sales history, stock on " +
        "hand, and lead time. There are 10 inbound units due before the coverage " +
        "period ends; the review period is 7 days and safety stock is 20 units. " +
        "Use only our figures; do not query the store or place an order.",
    );

    // require is an awaited hard precondition; check/other assertions record
    // results without stopping the script. Here it verifies session continuity.
    await t.require(second.sessionId, equals(first.sessionId));
    second.succeeded();
    second.calledTool("compute_restock_amount", {
      input: {
        unitsSold: 28,
        lookbackDays: 7,
        sellableOnHand: 15,
        inboundUnits: 10,
        leadTimeDays: 10,
        reviewPeriodDays: 7,
        safetyStockUnits: 20,
      },
      output: { projectedDemandUnits: 68, targetStockUnits: 88, restockUnits: 63 },
      count: 1,
    });

    // Run-scoped assertions cover both turns; toolOrder checks request order.
    t.succeeded();
    t.toolOrder(["estimate_stockout_risk", "compute_restock_amount"]);
    t.noFailedActions();
  },
});
