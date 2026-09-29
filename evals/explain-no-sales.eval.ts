import { defineEval } from "eve/evals";

// Feature: LLM-as-judge. Exact text matching is a poor fit for an explanation
// that can be accurate and clear in many different wordings. This is the only
// eval that calls t.judge; run it alone with: npm run eval -- --tag judge
export default defineEval({
  description: "LLM-as-judge: explain why zero recent sales cannot predict stockout.",
  tags: ["judge"],
  // The evaluator is separate from the agent under test. Jev uses the configured
  // Gateway credentials; other cases do not make evaluator requests.
  judge: { model: "typesafe-ai/jev" },
  async test(t) {
    const turn = await t.send(
      "Use the stockout-risk calculator for a product with 0 units sold over " +
        "7 days, 15 sellable unreserved units on hand, and a 10-day supplier lead " +
        "time. Explain the result in plain English for a store manager. Use only " +
        "these figures; do not query the store or change records.",
    );

    // Keep objective behavior as a hard gate; the judge scores the explanation,
    // not the arithmetic or whether the calculator actually ran.
    t.succeeded();
    t.calledTool("estimate_stockout_risk", {
      input: { unitsSold: 0, lookbackDays: 7, sellableOnHand: 15, leadTimeDays: 10 },
      output: {
        averageDailyUnitsSold: 0,
        daysUntilStockout: null,
        status: "no_recent_sales",
      },
      count: 1,
    });
    t.noFailedActions();

    // One rubric question produces a normalized 0-1 score. Supplying `on`
    // explicitly gives the judge both the response and a factual reference.
    t.judge(
      {
        type: "score",
        instructions:
          "Grade the response for factual accuracy and clear, plain-English " +
          "communication to a store manager, using the reference. It should " +
          "explain why zero recent sales does not establish a stockout date or " +
          "guarantee that stock lasts forever. Do not require specific wording.",
        criteria: [
          "Incorrect or misleading: invents a stockout date, guarantees stock " +
            "will last forever, or contradicts the provided figures.",
          "Partly useful: avoids false claims but does not clearly explain the " +
            "lack of demand data, or relies on unexplained technical jargon.",
          "Accurate and clear: explains that no recent sales means there is no " +
            "usable sales rate to predict when stock will run out, without " +
            "guaranteeing future demand stays at zero.",
        ],
      },
      {
        on: {
          response: turn.message ?? "",
          reference: {
            unitsSold: 0,
            lookbackDays: 7,
            sellableOnHand: 15,
            leadTimeDays: 10,
            daysUntilStockout: null,
            status: "no_recent_sales",
          },
        },
      },
    )
      .label("stockout explanation")
      // Soft bar: a low score is reported but only fails the command under
      // --strict. Judge authentication/provider errors still fail the eval.
      .atLeast(0.8);
  },
});
