import { defineEvalConfig } from "eve/evals";

// Every eval suite needs a root config, even when the defaults are sufficient.
// These evals use the agent's real model. Only the case tagged "judge" makes
// an additional evaluator request; deterministic assertions need no judge.
export default defineEvalConfig({});
