import { defineEvalConfig } from "eve/evals";

// A separate target and suite: all model decisions are scripted with mockModel.
// No agent-model or judge-provider credentials are needed for these evals.
export default defineEvalConfig({});
