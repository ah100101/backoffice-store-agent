import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

// Feature: human-in-the-loop approval and resume. Both decisions get their own
// session and verdict, using a mock model and a tool with no external effects.
export default (["approve", "cancel"] as const).map((optionId) =>
  defineEval({
    description: `Approval lifecycle: ${optionId} a simulated restock.`,
    tags: ["offline", "approval"],
    async test(t) {
      const parked = await t.send("Prepare a demo restock.");

      // Parked is the expected intermediate state, not a failed turn. Keep the
      // assertion on this immutable turn; the whole eval will later resume.
      parked.parked();
      parked.calledTool("preview_restock", {
        input: { productId: "demo-shirt", units: 63 },
        status: "pending",
        count: 1,
      });
      parked.calledTool("preview_restock", { status: "completed", count: 0 });

      // This lookup records a gate and requires exactly one matching request.
      // The request id is supplied by eve; never infer it from the tool name.
      const request = parked.session.requireInputRequest({
        toolName: "preview_restock",
        input: { productId: "demo-shirt", units: 63 },
        optionIds: ["approve", "cancel"],
      });
      const resumed = await parked.session.respond([
        { requestId: request.requestId, optionId },
      ]);
      await t.require(resumed.sessionId, equals(parked.sessionId));

      // Run-scoped assertions now inspect the settled lifecycle across both
      // turns. Approval permits execution; cancellation must never execute it.
      t.succeeded();
      if (optionId === "approve") {
        t.calledTool("preview_restock", {
          input: { productId: "demo-shirt", units: 63 },
          output: { productId: "demo-shirt", units: 63, simulated: true },
          status: "completed",
          count: 1,
        });
        t.noFailedActions();
      } else {
        t.calledTool("preview_restock", { status: "rejected", count: 1 });
        t.calledTool("preview_restock", { status: "completed", count: 0 });
        t.check(resumed.message, equals("Demo cancelled; no order was placed."));
      }
      // Neither outcome should cause the scripted model to request a retry.
      t.maxToolCalls(1);
    },
  }),
);
