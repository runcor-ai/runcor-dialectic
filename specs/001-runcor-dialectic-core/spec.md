# Feature Specification: runcor-dialectic v1.0 — Core Library

**Feature Branch**: `001-runcor-dialectic-core`
**Created**: 2026-05-03
**Status**: Draft
**Input**: User description: "Package the existing C:\runcor_dialectic\ prototype as a clean standalone npm sibling repo. Player/Coach/Judge with audit trail, fix early-convergence bug (Problems 4 and 15), add role variants, ship 15-problem benchmark."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a dialectic against a problem and get an audited answer (Priority: P1)

A consumer (a downstream runcor sibling, an agent, or a developer) has a hard problem that single-pass LLM calls answer plausibly-but-sometimes-wrongly. They invoke the dialectic with the problem text and a configuration of {Player, Coach, Judge} models. They receive back a final answer plus the complete audit trail (every Player draft, every Coach critique, every Judge convergence score, model identifiers, token counts, durations, cost) so they can inspect *how* the dialectic reasoned, not just *what* it concluded.

**Why this priority**: This is the core value proposition. Every other feature is in service of this. Without a callable dialectic that returns an audited answer, nothing else matters.

**Independent Test**: Can be fully tested by importing the library, calling `dialectic({player, coach, judge, problem})` with mock providers that return deterministic responses, and verifying the returned object contains all required fields (answer, transcript, cost, rounds, converged, convergence_reason).

**Acceptance Scenarios**:

1. **Given** a problem text and three configured providers, **When** `dialectic()` is called, **Then** the function returns `{answer: string, transcript: Round[], rounds: number, converged: boolean, convergence_reason: 'coach-converged' | 'judge-novelty' | 'max-rounds', cost: {usd: number, tokens: {input, output}}, duration_ms: number}`.

2. **Given** the dialectic completes 3 rounds, **When** the consumer inspects the transcript, **Then** the transcript contains exactly 7 entries in order: Player(0), Coach(0), Player(1), Coach(1), Player(2), Coach(2), Player(3 — final after coach round 2).

3. **Given** any provider call fails with a non-retriable error, **When** the dialectic is in progress, **Then** the function throws a typed error containing the round number, role, and underlying provider error — and partial transcript up to that point is attached to the error.

---

### User Story 2 - Convergence integrity: do NOT converge prematurely (Priority: P1)

The library MUST NOT converge on a final answer that fails to incorporate a substantive Coach critique. The v2 prototype failed Problems 4 (Ghost Employee) and 15 (Autonomous Shutdown) because the Coach raised a valid point but the Player's final revision didn't adopt it, and the Judge's novelty-only metric let it pass.

**Why this priority**: Per Constitution Principle II (NON-NEGOTIABLE). A dialectic that converges before incorporating valid critique is worse than no dialectic at all — it produces false confidence at higher cost.

**Independent Test**: Re-run Problems 4 and 15 from the existing v2 benchmark JSONs against the new library. The library MUST converge on an answer that contains a substring or paraphrase of the Coach's raised concern (e.g., the "ghost runner" in Problem 4 must appear in the final answer; the "preserve learnings for founder" in Problem 15 must appear).

**Acceptance Scenarios**:

1. **Given** the Coach raises a substantive new concern in round N, **When** the Player's revision in round N+1 does not address it (verified by Judge), **Then** the dialectic MUST NOT converge — it MUST proceed to another Coach round (or fail with `convergence_reason: 'max-rounds-without-incorporation'` if max rounds exhausted).

2. **Given** the Coach has no new substantive objections, **When** the Coach emits its critique, **Then** the Coach MUST explicitly enumerate "no objection on data, no objection on options, no objection on framing" before emitting `CONVERGED`. A bare `CONVERGED` without the enumeration is invalid and triggers re-prompt.

3. **Given** Problem 4 (Ghost Employee) from the v2 benchmark, **When** the dialectic runs to completion, **Then** the final answer MUST mention the unaccounted-for runner (the "ghost") that the original v2 missed.

4. **Given** Problem 15 (Autonomous Shutdown) from the v2 benchmark, **When** the dialectic runs to completion, **Then** the final answer MUST include language about preserving learnings for the founder (the Coach's good point that the v2 final answer failed to incorporate).

---

### User Story 3 - Cost transparency per call (Priority: P1)

Every dialectic call returns a precise cost breakdown in USD computed at call time using current per-model pricing — not estimated post-hoc, not summed across calls.

**Why this priority**: Per Constitution Principle IV. The empirical claim "comparable quality at 25% of the cost" is unverifiable without exact cost reporting. Future runcor-memory drives also depend on cost-as-pressure being a real signal.

**Independent Test**: Run the dialectic against a known-cost problem with mock providers that report fixed token counts. Verify the returned `cost.usd` matches the sum of `input_tokens × input_price_per_million + output_tokens × output_price_per_million` for each model used.

**Acceptance Scenarios**:

1. **Given** a dialectic run with 2 Player calls (Nemotron 120B), 2 Coach calls (Qwen 3 32B), 2 Judge calls (Llama 3.1 8B) at known token counts, **When** the run completes, **Then** `cost.usd` equals the exact sum of per-model costs at current OpenRouter pricing.

2. **Given** a `budget_cap_usd` parameter is supplied, **When** the cumulative cost would exceed the cap mid-run, **Then** the dialectic terminates with `convergence_reason: 'budget-exhausted'` and returns the partial transcript + final-answer-so-far.

3. **Given** a custom provider with a custom price-per-token, **When** registered with the library, **Then** cost computation uses the custom prices.

---

### User Story 4 - Role variants and role registry (Priority: P2)

Beyond the canonical Player/Coach/Judge triad, problem types may need variant role-sets (Devil's Advocate, Long-Term Thinker, Cost-Conscious Critic, inter-agent Player-A/Player-B/Judge). The library exposes a role registry allowing consumers to register named roles with prompts and routing rules, then invoke the dialectic with a role-set name.

**Why this priority**: Required by collapsed Component #5 (Blackboard convergence is inter-agent dialectic). Role variants extend the library's reach without a new component.

**Independent Test**: Register a custom role-set, invoke the dialectic with that role-set name, verify the correct prompts are used.

**Acceptance Scenarios**:

1. **Given** a registered role-set `{playerA, playerB, judge}`, **When** the dialectic is invoked with `roleSet: 'inter-agent'`, **Then** Player-A and Player-B alternate proposals, Judge ratifies — no Coach involvement.

2. **Given** a registered role-set `{player, devil-advocate, long-term, cost-critic, judge}`, **When** the dialectic is invoked with `roleSet: 'multi-critic'`, **Then** Player drafts; each critic role critiques in sequence; Judge ratifies.

3. **Given** an unregistered role-set name, **When** the dialectic is invoked with that name, **Then** the function throws `UnknownRoleSetError` with a list of available role-sets.

---

### User Story 5 - Provider-agnostic adapter API (Priority: P2)

The library MUST accept any model provider via a `complete(messages, options) → {content, tokens, cost, duration}` adapter interface. Default implementations are bundled for OpenRouter and Anthropic; consumers can register additional providers without modifying core dialectic logic.

**Why this priority**: Per Constitution Principle V. Future-proofs the library against provider changes; allows downstream consumers (runcor engine) to substitute their own model router.

**Independent Test**: Implement a custom adapter that returns canned responses, register it as a provider, run a dialectic using only that adapter, verify the dialectic succeeds end-to-end.

**Acceptance Scenarios**:

1. **Given** a custom provider satisfies the adapter interface, **When** registered as `'my-provider'`, **Then** Player/Coach/Judge can be configured with `model: 'my-provider/some-model'` and the dialectic uses the custom adapter.

2. **Given** the OpenRouter adapter, **When** a 429 rate-limit response is received, **Then** the adapter retries with exponential backoff (15s, 30s, 45s) up to 3 attempts before throwing.

3. **Given** any adapter throws an error, **When** the dialectic is in progress, **Then** the error is wrapped in `ProviderError` with provider name + model + round + role attached.

---

### User Story 6 - 15-problem benchmark as runnable example (Priority: P2)

The library ships with the 15-problem benchmark from the v2 prototype as `examples/15-problems.ts`. Running it produces a results.json structurally identical to the v2 outputs, plus a summary line showing accuracy and total cost.

**Why this priority**: Reproducibility of the published "93% vs 95% Claude at 25% cost" claim. Required by Constitution Quality Gate "benchmark gate."

**Independent Test**: Run `npm run example:15-problems` with the OpenRouter API key set; verify a results.json file is produced with 15 entries; verify the summary shows >= 93% material accuracy.

**Acceptance Scenarios**:

1. **Given** the OPENROUTER_API_KEY is set, **When** `npm run example:15-problems` is invoked, **Then** the command runs all 15 problems, writes `examples/15-problems-results.json`, and prints a summary with material accuracy percentage and total cost.

2. **Given** the OPENROUTER_API_KEY is not set, **When** the command is invoked, **Then** it exits with a clear error message explaining how to set the key.

3. **Given** the benchmark completes, **When** the results JSON is inspected, **Then** every problem has `dialectic`, `baseline`, and `humanScore` fields matching the v2 prototype's schema.

---

### Edge Cases

- **Provider returns empty content**: Adapter retries up to 3 times with 10s wait; if still empty, throws `EmptyResponseError`.
- **Coach emits CONVERGED on round 1 without enumeration**: Library re-prompts Coach with stronger convergence-instruction; if still bare CONVERGED, treats as `convergence_reason: 'coach-bare-converged-warning'` and proceeds to Judge novelty check.
- **Judge novelty score parsing fails**: Default to 0.5 (neutral), log warning, continue.
- **Provider returns chain-of-thought content despite prompt forbidding it**: Library strips `<think>...</think>` blocks before adding to transcript; logs warning; does not retry.
- **Network outage mid-run**: Each provider call retries up to 3 times; if all fail, dialectic throws with full partial transcript attached.
- **Problem text exceeds context window of weakest model**: Adapter throws `ContextOverflowError`; library does not retry with truncation (consumer's choice to handle).
- **Same problem invoked twice in parallel**: Library is stateless — both calls run independently; no shared state between concurrent dialectic invocations.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST expose a single `dialectic(options)` factory function as the primary public API.
- **FR-002**: System MUST accept Player, Coach, Judge configurations including model identifier, system prompt, and provider-specific options.
- **FR-003**: System MUST run the dialectic loop: Player draft → Coach critique → (Player revise → Coach critique)* → final Player answer.
- **FR-004**: System MUST terminate on any of: Coach emits valid CONVERGED with enumeration, Judge novelty score ≥ threshold, max rounds reached, budget exhausted, fatal provider error.
- **FR-005**: System MUST return a complete transcript of every model call with model name, role, content, token counts, duration, cost.
- **FR-006**: System MUST compute and return per-call and total cost in USD using current per-model pricing.
- **FR-007**: System MUST validate that Coach convergence enumerates "no objection on data, no objection on options, no objection on framing" before accepting CONVERGED.
- **FR-008**: System MUST verify (via Judge) that the final Player answer incorporates substantive Coach critiques raised in prior rounds; if not, MUST NOT converge.
- **FR-009**: System MUST expose a role registry allowing consumers to register named roles and role-sets.
- **FR-010**: System MUST expose a provider adapter registry allowing consumers to register custom providers.
- **FR-011**: System MUST ship a runnable 15-problem benchmark example reproducing v2 prototype results.
- **FR-012**: System MUST regression-test Problems 4 and 15 to ensure the early-convergence bug does not recur.
- **FR-013**: System MUST NOT modify or depend on the source code of any other runcor-ai sibling repo.
- **FR-014**: System MUST be importable as `import { dialectic, registerRole, registerProvider } from 'runcor-dialectic'`.
- **FR-015**: System MUST support a `budget_cap_usd` parameter that terminates the dialectic when cumulative cost exceeds the cap.

### Key Entities

- **DialecticConfig**: `{player, coach, judge, problem, maxRounds?, roleSet?, budget_cap_usd?, convergenceThreshold?}` — input to a dialectic call.
- **RoleConfig**: `{role: 'player'|'coach'|'judge'|string, model: string, systemPrompt: string, providerOptions?}` — per-role configuration.
- **Round**: `{number: int, role: string, model: string, content: string, tokens: {input, output}, cost_usd: number, duration_ms: number, timestamp: ISO8601}` — single entry in the audit trail.
- **DialecticResult**: `{answer, transcript: Round[], rounds: number, converged: boolean, convergence_reason: string, cost: {usd, tokens}, duration_ms}` — return value.
- **ProviderAdapter**: interface `{complete(messages, options): Promise<{content, tokens, cost_usd, duration_ms}>}` — the contract any provider must satisfy.
- **RoleSet**: named collection of roles defining how a dialectic instance routes turns (canonical Player/Coach/Judge, inter-agent A/B/Judge, multi-critic, etc.).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running the 15-problem benchmark on a fresh install produces ≥93% material accuracy at ≤30% of the cost of Claude Sonnet 4 baseline (matching the v2 published claim).
- **SC-002**: Problems 4 and 15 from the v2 benchmark MUST converge on answers that contain the previously-missed Coach concern, verified by automated substring/paraphrase check (Convergence regression gate).
- **SC-003**: Median dialectic call completes in under 60 seconds (across the 15-problem benchmark, excluding warm-up).
- **SC-004**: Library install + benchmark run completes in under 10 minutes from a fresh clone (including npm install + 15 dialectic runs).
- **SC-005**: API surface is small: ≤5 exported symbols total. Adding a custom provider requires ≤30 lines of consumer code.
- **SC-006**: Test coverage ≥80% on `src/`, 100% on convergence-decision code paths.
- **SC-007**: Zero modifications to any other runcor-ai sibling repo introduced as part of this build.

## Assumptions

- The OpenRouter API remains available and supports the Player/Coach/Judge models named in the v2 prototype (Nemotron 120B, Qwen 3 32B, Llama 3.1 8B). If a model is deprecated, an equivalent substitute is acceptable per Constitution Principle V.
- Anthropic SDK remains available for the Claude Sonnet 4 baseline used in the benchmark.
- Node.js >= 20.6.0 is the target runtime (matches runcor sibling convention).
- TypeScript strict mode is the build target (matches runcor sibling convention).
- Vitest is the test framework (matches runcor sibling convention).
- The 15-problem benchmark JSON files in `C:\runcor_dialectic\` are the canonical reference outputs against which v1.0 results are validated.
- Per-model pricing for OpenRouter models can be fetched at install time or hard-coded with documented refresh policy.
- Network connectivity to OpenRouter and Anthropic is available during benchmark runs (no offline mode required for v1.0).
- The library has no persistent state — each `dialectic()` call is independent. Persistence (storing transcripts for downstream consumers) is the consumer's responsibility.

## Constitutional Alignment

This spec depends on:
- **Principle I (Standalone Sibling First)** → FR-013, FR-014, SC-007
- **Principle II (Convergence Integrity)** → FR-007, FR-008, FR-012, US2 entirely, SC-002
- **Principle III (Audit Trail Preservation)** → FR-005, US1 acceptance scenario 2
- **Principle IV (Cost Transparency)** → FR-006, FR-015, US3 entirely, SC-001
- **Principle V (Provider Agnosticism)** → FR-010, US5 entirely, SC-005
