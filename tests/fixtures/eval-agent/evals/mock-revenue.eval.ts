import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

// Feature: deterministic fixture models. This uses a real eve server with
// scripted model decisions and the real revenue calculator, not a live LLM.
export default defineEval({
  description: "Mock model: exercise a real calculator tool loop without provider calls.",
  tags: ["offline", "mock-model"],
  async test(t) {
    const turn = await t.send("Calculate demo net revenue.");

    t.succeeded();
    t.calledTool("compute_net_revenue", {
      input: { salesMinor: 100_000, refundsMinor: 12_000, currency: "USD" },
      output: { currency: "USD", netRevenueMinor: 88_000 },
      count: 1,
    });
    t.maxToolCalls(1);
    t.noFailedActions();
    // Exact wording is appropriate here because the fixture model's response
    // is scripted. This checks runtime wiring, not a live model's reasoning.
    t.check(
      turn.message,
      equals('Demo result: {"currency":"USD","netRevenueMinor":88000}'),
    );
  },
});
