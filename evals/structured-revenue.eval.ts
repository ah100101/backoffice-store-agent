import { defineEval } from "eve/evals";
import { z } from "zod";

const revenueSummary = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  netRevenueMinor: z.number().int(),
}).strict();

// Feature: structured output. A turn can request a schema-defined result,
// rather than asking the eval to extract JSON or numbers from reply text.
export default defineEval({
  description: "Structured output: return a schema-validated revenue summary.",
  tags: ["deterministic", "structured-output"],
  async test(t) {
    const turn = await t.send(
      "For the same reporting period, completed sales were $1,000 USD and refunds " +
        "were $120 USD. Both exclude tax and shipping. Use the net-revenue " +
        "calculator and return a summary with currency and netRevenueMinor " +
        "in cents. Use only these figures; do not query the store or change records.",
      // The schema applies only to this turn, not to all future session messages.
      { outputSchema: revenueSummary },
    );

    t.succeeded();
    t.calledTool("compute_net_revenue", {
      input: { salesMinor: 100_000, refundsMinor: 12_000, currency: "USD" },
      output: { currency: "USD", netRevenueMinor: 88_000 },
      count: 1,
    });
    // These assertions inspect the assistant's final structured result (data),
    // not the calculator's output or the human-readable message.
    turn.outputMatches(revenueSummary);
    turn.outputEquals({ currency: "USD", netRevenueMinor: 88_000 });
    t.noFailedActions();
  },
});
