import { defineAgent } from "eve";
import { mockModel } from "eve/evals";

// This separate fixture app never changes the production agent's model.
// mockModel scripts model decisions, but eve still runs the actual HTTP,
// session, approval, and tool-execution machinery around those decisions.
export default defineAgent({
  // Custom/mock models are absent from the Gateway catalog. Supply metadata
  // locally so eve can compile its normal context/compaction configuration.
  modelContextWindowTokens: 16_384,
  model: mockModel(({ lastUserMessage, toolResults }) => {
    const result = toolResults.at(-1);
    if (result) {
      // Denied calls also reach the model as tool results. Do not retry a
      // cancelled action; finish the turn without another approval prompt.
      return result.isError
        ? "Demo cancelled; no order was placed."
        : `Demo result: ${JSON.stringify(result.output)}`;
    }

    if (lastUserMessage === "Prepare a demo restock.") {
      return {
        toolCalls: [{
          name: "preview_restock",
          input: { productId: "demo-shirt", units: 63 },
        }],
      };
    }
    if (lastUserMessage === "Calculate demo net revenue.") {
      return {
        toolCalls: [{
          name: "compute_net_revenue",
          input: { salesMinor: 100_000, refundsMinor: 12_000, currency: "USD" },
        }],
      };
    }

    throw new Error(`Unsupported fixture prompt: ${lastUserMessage}`);
  }),
});
