import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";

// A harmless approval-gated fixture. Its only effect is returning sample data:
// no HTTP requests, filesystem writes, purchase orders, or store mutations.
export default defineTool({
  description: "Preview a simulated restock after explicit human approval.",
  inputSchema: z.object({
    productId: z.literal("demo-shirt"),
    units: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  }),
  outputSchema: z.object({
    productId: z.literal("demo-shirt"),
    units: z.number().int().positive(),
    simulated: z.literal(true),
  }),
  // always() is deterministic. auto() would introduce another evaluator call,
  // which is deliberately avoided so the repo keeps exactly one judge case.
  approval: always(),
  execute({ productId, units }) {
    return { productId, units, simulated: true as const };
  },
});
