# Back-office store agent

An [eve](https://eve.dev) agent for employees managing the Vercel Swag Store, with a small eval suite demonstrating how to test agent behavior.

The agent connects to the store's OpenAPI service through [agent/connections/store.ts](agent/connections/store.ts) and exposes three read-only calculators under [agent/tools/](agent/tools/):

- `compute_net_revenue`: subtract refunds from completed sales using currency minor units, such as USD cents.
- `compute_restock_amount`: recommend a reorder quantity from sales history, lead time, safety stock, on-hand stock, and inbound units.
- `estimate_stockout_risk`: estimate days until stockout and compare that with supplier lead time.

The calculators use supplied figures; they do not fetch store data, issue refunds, or place orders. Agent instructions live in [agent/instructions.md](agent/instructions.md), and the model is configured in [agent/agent.ts](agent/agent.ts).

## Get started

Use Node.js 24.x and pnpm:

```bash
pnpm install
npm run dev
```

The eve terminal UI opens an interactive conversation and reloads authored changes. Use `/login` to connect to Vercel AI Gateway, or supply `AI_GATEWAY_API_KEY` in your environment. The configured agent model is `spacexai/grok-4.7`.

## Eval walkthrough

Each example highlights a different eve eval feature. Read them in the order below; this is a learning sequence, not a required execution order.

Eve discovers `.eval.ts` files under `evals/`. Each uses `defineEval({ async test(t) { ... } })` to send messages and assert on the results. The required [evals.config.ts](evals/evals.config.ts) uses eve's defaults. The runner starts a real agent server and drives the same HTTP sessions used by clients, so these evals test agent behavior, not just calculator arithmetic.

### 1. Greeting: negative assertions

[greeting.eval.ts](evals/greeting.eval.ts) sends "Hi!" and checks that the agent succeeds without calling any tools.

**What eve provides:** `t.succeeded()` checks successful completion; `t.usedNoTools()` rejects any tool request, including failed or pending calls. Both are hard gates by default. You can test what the agent should *not* do without prescribing its exact reply.

### 2. Net revenue: tool-call matching

[net-revenue.eval.ts](evals/net-revenue.eval.ts) supplies $1,000 USD in sales and $120 USD in refunds. It expects the agent to call the revenue tool with 100,000 and 12,000 cents and receive 88,000 cents ($880).

**What eve provides:** `t.calledTool(...)` matches a completed tool call's input, output, and count. Object matchers use partial-deep matching. This checks the actual calculation path rather than a plausible number in the final message; `t.maxToolCalls(1)` also rejects extra calls.

### 3. Restock cases: dataset fan-out

[restock-cases.eval.ts](evals/restock-cases.eval.ts) exports an array of three fixtures:

- Normal reorder: recommend **63 units**.
- Ample stock: recommend **0 units**, never a negative quantity.
- Fractional demand: round up to **1 unit**.

**What eve provides:** an array of `defineEval(...)` values becomes independently scored cases with IDs `restock-cases/0000`, `restock-cases/0001`, and `restock-cases/0002`. Each gets its own conversation and verdict. The fixtures are inline here; eve also provides `loadJson` and `loadYaml` for larger datasets.

### 4. Inventory follow-up: multi-turn sessions

[inventory-follow-up.eval.ts](evals/inventory-follow-up.eval.ts) first estimates stockout at **3.75 days**. A follow-up reuses the sales history, on-hand stock, and lead time, adds the remaining restock inputs, and expects a recommendation of **63 units**.

**What eve provides:** `first.session.send(...)` continues the existing conversation, whereas another `t.send(...)` would create a new one. Turn-scoped assertions check each response separately; `t.require(..., equals(...))` verifies session identity, and `t.toolOrder(...)` checks the order across both turns.

### 5. No recent sales: LLM-as-judge

[explain-no-sales.eval.ts](evals/explain-no-sales.eval.ts) supplies zero recent sales. Hard assertions require the tool to return `daysUntilStockout: null` and `status: "no_recent_sales"`. A judge then grades whether the explanation is accurate and clear, without inventing a stockout date or claiming the stock will last forever.

**What eve provides:** `t.judge(...)` uses a separate evaluator, `typesafe-ai/jev`, with a rubric and an explicit factual reference. It produces a normalized 0–1 score. `.atLeast(0.8)` sets a soft threshold: a lower score is reported and only fails the command under `--strict`.

This is the only judge case. The main suite uses the live agent model even when grading is deterministic. Missing judge credentials or provider errors fail the eval even without `--strict`. If AI Gateway blocks Jev under your team's provider allowlist, a team owner must enable its provider before judge scoring can run.

### 6. Revenue summary: structured output

[structured-revenue.eval.ts](evals/structured-revenue.eval.ts) requests a final response containing `currency` and `netRevenueMinor`. It checks the calculator call, then expects the assistant's structured result to be `{ currency: "USD", netRevenueMinor: 88000 }`.

**What eve provides:** pass a Zod `outputSchema` to `t.send(...)` to request schema-defined data for that turn. `turn.outputMatches(...)` validates its shape, while `turn.outputEquals(...)` checks its value. These assertions inspect the final structured response, not the tool output or JSON extracted from prose.

### 7. Mocked revenue: provider-free fixtures

[mock-revenue.eval.ts](tests/fixtures/eval-agent/evals/mock-revenue.eval.ts) runs against a [separate fixture agent](tests/fixtures/eval-agent/agent/agent.ts). Its model scripts a revenue tool call and a reply based on the actual result. The fixture reuses the real calculator, but has no store connection and does not replace the main agent's model.

**What eve provides:** `mockModel(...)` supplies deterministic model decisions without provider requests. The eval still exercises the real server, sessions, and tool loop. Exact reply matching is useful here because the model is scripted; this tests runtime wiring, not a live model's reasoning. Run it through the fixture suite rather than the main suite.

### 8. Approval and resume: human-in-the-loop

[approval-resume.eval.ts](tests/fixtures/eval-agent/evals/approval-resume.eval.ts) has two independent cases: approve and cancel. Both first require the [preview tool](tests/fixtures/eval-agent/agent/tools/preview_restock.ts) to remain pending. Approval allows one execution; cancellation rejects the call without execution. The tool only returns simulated data and cannot place an order.

**What eve provides:** `approval: always()` gates execution without an evaluator request. `parked.parked()` checks the intermediate waiting state; `session.requireInputRequest(...)` finds the pending request; `session.respond(...)` answers it and resumes the same conversation. Lifecycle matchers distinguish pending, completed, and rejected calls. Both cases use the fixture's mock model and require no provider credentials.

## Run the evals

Six main-suite files expand into **eight live-model cases**. Two fixture files add **three provider-free cases**. The fixture uses dependencies installed at the repository root; no separate install is needed.

```bash
# Discover all cases without making model requests.
pnpm eval --list

# Run seven live-model cases; the judge is excluded by default.
pnpm evals

# Opt into all eight live-model cases, including the judge.
pnpm eval --strict

# Run one example or the complete restock dataset.
pnpm eval net-revenue
pnpm eval restock-cases

# Run only the judge case with its threshold enforced.
pnpm eval --tag judge --strict

# Run the structured-output case against the live agent.
pnpm evals structured-revenue

# Discover or run the separate provider-free fixture suite.
pnpm evals:fixtures --list
pnpm evals:fixtures
```

Eve prints per-case results and saves assertions, verdicts, and captured event streams under `.eve/evals/<timestamp>/` relative to each suite's project root (the repository root or `tests/fixtures/eval-agent/`). Exit codes are `0` for success, `1` for an eval failure, and `2` for a configuration error. For CI, add `--junit .eve/junit.xml`; to test an existing deployment, add `--url https://<app>`.

Other checks:

```bash
npm run typecheck
node --test tests/calculation-tools.test.mjs
```

## Learn more

- [Eve evals](https://eve.dev/docs/evals/overview)
- [Eve getting started](https://eve.dev/docs/getting-started)
- Installed framework docs: `node_modules/eve/docs/`
