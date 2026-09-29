import { defineEval } from "eve/evals";

// Feature: tool-call matching. Assert on the actual validated arguments and
// result instead of accepting a plausible-looking number in the final reply.
export default defineEval({
  description: "Tool-call matching: convert USD to cents and subtract refunds.",
  tags: ["deterministic", "tool-matching"],
  async test(t) {
    await t.send(
      "For the same reporting period, completed sales were $1,000 USD and refunds " +
        "were $120 USD. Both totals exclude tax and shipping. Use the net-revenue " +
        "calculator to compute revenue after refunds. Use only these figures; " +
        "do not query the store or change any records.",
    );

    t.succeeded();
    // Object matchers are partial-deep matches. Supplying every business field
    // verifies currency conversion as well as the subtraction. Calls must be
    // completed by default; count applies to calls matching all these fields.
    t.calledTool("compute_net_revenue", {
      input: { salesMinor: 100_000, refundsMinor: 12_000, currency: "USD" },
      output: { currency: "USD", netRevenueMinor: 88_000 },
      count: 1,
    });
    // Also reject unrelated calls or retries with different arguments.
    t.maxToolCalls(1);
  },
});
