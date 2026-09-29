import { defineEval } from "eve/evals";

// Feature: negative assertions. Correct behavior sometimes means NOT using a
// tool. We check the agent's actions without prescribing its greeting text.
export default defineEval({
  description: "Negative assertions: a greeting needs no tools.",
  tags: ["deterministic", "negative-assertions"],
  async test(t) {
    await t.send("Hi!");

    // Scoped assertions on t grade the whole run and are hard gates by default.
    t.succeeded();
    // This rejects any tool request, including failed or pending calls.
    t.usedNoTools();
  },
});
