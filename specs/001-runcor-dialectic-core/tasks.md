---
description: "Task list for runcor-dialectic v1.0 — Core Library"
---

# Tasks: runcor-dialectic v1.0 — Core Library

**Input**: Design documents from `/specs/001-runcor-dialectic-core/`
**Prerequisites**: plan.md ✅, spec.md ✅
**Tests**: Test tasks INCLUDED — Constitution Quality Gates require ≥80% coverage and 100% on convergence-decision paths.

**Organization**: Tasks grouped by user story for independent implementation. Task ID prefix: T.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1-US6) or SETUP/FOUND/POLISH

## Path Conventions

Single-project library at `C:\runcor May 3 2026\runcor-dialectic\`. All paths relative to that root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project scaffolding so any subsequent task has a working build.

- [ ] T001 Create `package.json` with name=`runcor-dialectic`, version=`0.1.0`, type=`module`, scripts (test, build, dev, example:single-call, example:15-problems), deps (dotenv, @anthropic-ai/sdk), devDeps (vitest, tsup, typescript, @types/node).
- [ ] T002 [P] Create `tsconfig.json` with strict mode, target ES2022, module NodeNext, declaration true, outDir dist.
- [ ] T003 [P] Create `tsup.config.ts` for dual ESM+CJS export with .d.ts generation.
- [ ] T004 [P] Create `vitest.config.ts` with coverage thresholds (80% global, 100% on `src/convergence.ts`).
- [ ] T005 [P] Create `.gitignore` (node_modules, dist, .env, coverage, *.log).
- [ ] T006 [P] Create `.env.example` documenting OPENROUTER_API_KEY and ANTHROPIC_API_KEY (Anthropic only needed for benchmark baseline).
- [ ] T007 [P] Create `LICENSE` (MIT, matches runcor sibling convention).
- [ ] T008 [P] Create `README.md` with installation, quickstart, API reference, link to constitution + spec.
- [ ] T009 [P] Create `CLAUDE.md` with project overview for AI agents working in this repo.
- [ ] T010 Run `npm install` and verify clean install.

**Checkpoint**: Project scaffolded — TS compiles, tests run (zero tests yet), example scripts wired.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, errors, provider adapter contract, role registry skeleton — required by every user story.

**⚠️ CRITICAL**: No user story work begins until this phase completes.

- [ ] T011 [FOUND] Create `src/types.ts` with all public types: `DialecticConfig`, `RoleConfig`, `Round`, `DialecticResult`, `ProviderAdapter`, `RoleSet`, `ProviderRegistry`, `RoleRegistry`, `CostBreakdown`, `Tokens`, `ConvergenceReason`.
- [ ] T012 [P] [FOUND] Create `src/errors.ts` with typed errors: `ProviderError`, `ConvergenceError`, `BudgetExhaustedError`, `UnknownRoleSetError`, `EmptyResponseError`, `ContextOverflowError`. Each error includes round, role, model, partial-transcript fields where relevant.
- [ ] T013 [FOUND] Create `src/cost.ts` with: per-model price table (Nemotron 120B, Qwen 3 32B, Llama 3.1 8B, Claude Sonnet 4 — input + output USD per 1M tokens), `computeCost(model, tokens)` function, `BudgetTracker` class with `add(cost)` and `wouldExceed(cost, cap)` methods.
- [ ] T014 [P] [FOUND] Create `src/providers/index.ts` with `registerProvider(name, adapter)`, `getProvider(name)`, `getProviderFromModel(modelId)` (parses `provider/model-name` format).
- [ ] T015 [P] [FOUND] Create `src/providers/mock.ts` with `MockAdapter` returning canned responses for tests. Constructor takes a response queue per role; `complete()` pops next response.
- [ ] T016 [FOUND] Create `src/roles/index.ts` with `registerRole(name, config)`, `getRole(name)`, `registerRoleSet(name, roles[])`, `getRoleSet(name)`, default registration of canonical role-set.
- [ ] T017 [P] [FOUND] Unit test `tests/unit/cost.test.ts` for `computeCost` and `BudgetTracker`.
- [ ] T018 [P] [FOUND] Unit test `tests/unit/providers.test.ts` for registry behavior + `getProviderFromModel` parsing.
- [ ] T019 [P] [FOUND] Unit test `tests/unit/roles.test.ts` for registry behavior.

**Checkpoint**: Foundation complete. Types, errors, cost, providers, roles all in place. User stories can now begin in parallel.

---

## Phase 3: User Story 1 — Run a dialectic and get an audited answer (Priority: P1) 🎯 MVP

**Goal**: Consumer can `import { dialectic }` and run it against a problem with mock providers, getting back a complete audited result.

**Independent Test**: `tests/integration/dialectic.test.ts` runs full loop with `MockAdapter` returning deterministic responses; verifies returned object structure matches spec FR-001 through FR-005.

### Tests for User Story 1 (write FIRST, ensure FAIL before implementation)

- [ ] T020 [P] [US1] Integration test `tests/integration/dialectic.test.ts`: full loop completes, returns result with answer/transcript/rounds/converged/convergence_reason/cost/duration_ms.
- [ ] T021 [P] [US1] Integration test `tests/integration/dialectic.test.ts::transcript-ordering`: 3-round dialectic produces transcript with exact order [Player-0, Coach-0, Player-1, Coach-1, Player-2, Coach-2, Player-3].
- [ ] T022 [P] [US1] Integration test `tests/integration/dialectic.test.ts::provider-error`: provider error throws typed error with round/role/partial transcript attached.

### Implementation for User Story 1

- [ ] T023 [P] [US1] Create `src/providers/openrouter.ts` with `OpenRouterAdapter` (HTTP fetch, 429 retry with backoff 15/30/45s, parses tokens from `usage.prompt_tokens`/`usage.completion_tokens`, computes cost via cost.ts).
- [ ] T024 [P] [US1] Create `src/providers/anthropic.ts` with `AnthropicAdapter` (uses @anthropic-ai/sdk, returns same shape as other adapters).
- [ ] T025 [US1] Create `src/roles/canonical.ts` with default Player/Coach/Judge prompts ported verbatim from `C:\runcor_dialectic\test-harness-v2.js` lines 18-57. Coach prompt updated per Convergence Integrity spec (Constitution Principle II).
- [ ] T026 [US1] Create `src/dialectic.ts` with the main loop: build initial Player message → call provider → push to transcript → for round in 1..maxRounds: call Coach → check convergence → if not converged: call Player revision → push to transcript → finally extract last Player content as answer.
- [ ] T027 [US1] Create `src/index.ts` exporting `dialectic`, `registerRole`, `registerProvider`, all public types.
- [ ] T028 [US1] Create `examples/single-call.ts`: minimal example invoking `dialectic()` with a built-in problem and printing the result.
- [ ] T029 [US1] Add error handling in `dialectic.ts`: wrap provider errors in ProviderError with round/role/partial transcript, propagate.
- [ ] T030 [US1] Run vitest — confirm US1 tests pass.

**Checkpoint**: ✅ User Story 1 complete. The library is callable end-to-end with mock providers. MVP is functional.

---

## Phase 4: User Story 2 — Convergence integrity, no premature convergence (Priority: P1)

**Goal**: Coach must enumerate before CONVERGED; Judge must verify Player incorporated raised concerns; Problems 4 and 15 regression tests pass.

**Independent Test**: `tests/regression/problem-04-ghost-employee.test.ts` and `tests/regression/problem-15-autonomous-shutdown.test.ts` both pass against MockAdapter replaying the v2 transcripts plus the corrected behavior.

### Tests for User Story 2

- [ ] T031 [P] [US2] Unit test `tests/unit/convergence.test.ts::coach-enumeration`: bare CONVERGED rejected; CONVERGED with all three enumeration phrases accepted.
- [ ] T032 [P] [US2] Unit test `tests/unit/convergence.test.ts::judge-incorporation-veto`: when Coach raised concern X and final Player answer doesn't contain X-paraphrase, convergence vetoed.
- [ ] T033 [P] [US2] Regression test `tests/regression/problem-04-ghost-employee.test.ts`: replay Problem 4 from v2 JSON; assert final answer mentions the ghost runner.
- [ ] T034 [P] [US2] Regression test `tests/regression/problem-15-autonomous-shutdown.test.ts`: replay Problem 15; assert final answer includes "preserve learnings" or paraphrase.

### Implementation for User Story 2

- [ ] T035 [P] [US2] Create `src/convergence.ts` with: `validateCoachConvergence(critique) → {valid: boolean, missingEnumerations: string[]}`; `checkIncorporation(coachConcerns: string[], finalAnswer: string, judge: ProviderAdapter) → {incorporated: boolean, missing: string[]}`; `extractCoachConcerns(critique) → string[]`.
- [ ] T036 [US2] Update `src/roles/canonical.ts` Coach prompt: add explicit instruction "Before emitting CONVERGED, you MUST list 'no objection on data', 'no objection on options', 'no objection on framing' — bare CONVERGED will be rejected."
- [ ] T037 [US2] Update `src/dialectic.ts`: integrate `validateCoachConvergence` (re-prompt Coach once if invalid) and `checkIncorporation` (re-run Coach with stronger prompt if incorporation fails).
- [ ] T038 [US2] Add `convergence_reason` cases: `coach-converged-validated`, `coach-bare-converged-warning`, `judge-novelty`, `judge-incorporation-vetoed`, `max-rounds-without-incorporation`, `max-rounds`.
- [ ] T039 [US2] Run vitest unit + regression — confirm US2 tests pass.

**Checkpoint**: ✅ User Story 2 complete. Convergence integrity enforced; Problems 4 and 15 regression tests passing.

---

## Phase 5: User Story 3 — Cost transparency per call (Priority: P1)

**Goal**: Every dialectic call returns exact cost in USD; budget cap parameter terminates run when exceeded.

**Independent Test**: `tests/unit/cost.test.ts` validates exact computation; `tests/integration/dialectic.test.ts::budget-cap` validates termination.

### Tests for User Story 3

- [ ] T040 [P] [US3] Unit test `tests/unit/cost.test.ts::computeCost-exact`: known token counts produce exact USD per pricing table.
- [ ] T041 [P] [US3] Unit test `tests/unit/cost.test.ts::custom-prices`: custom price table overrides defaults.
- [ ] T042 [P] [US3] Integration test `tests/integration/dialectic.test.ts::budget-cap`: dialectic terminates with `convergence_reason: 'budget-exhausted'` when cap exceeded mid-run.

### Implementation for User Story 3

- [ ] T043 [US3] Update `src/dialectic.ts` to integrate `BudgetTracker` from cost.ts: pre-call check via `wouldExceed`, terminate with budget-exhausted reason if true.
- [ ] T044 [US3] Update each provider adapter (`openrouter.ts`, `anthropic.ts`, `mock.ts`) to populate `cost_usd` per call using cost.ts.
- [ ] T045 [US3] Add `customPrices` parameter to `dialectic()` config, threaded into cost computation.
- [ ] T046 [US3] Run vitest — confirm US3 tests pass.

**Checkpoint**: ✅ User Story 3 complete. Cost transparency working end-to-end with budget cap.

---

## Phase 6: User Story 4 — Role variants and role registry (Priority: P2)

**Goal**: Inter-agent and multi-critic role-sets work; consumers can register custom role-sets.

**Independent Test**: `tests/integration/role-variants.test.ts` runs both inter-agent and multi-critic role-sets against MockAdapter.

### Tests for User Story 4

- [ ] T047 [P] [US4] Integration test `tests/integration/role-variants.test.ts::inter-agent`: Player-A and Player-B alternate; Judge ratifies; no Coach.
- [ ] T048 [P] [US4] Integration test `tests/integration/role-variants.test.ts::multi-critic`: Player drafts; Devil's Advocate, Long-Term, Cost-Conscious all critique in sequence; Judge ratifies.
- [ ] T049 [P] [US4] Unit test `tests/unit/roles.test.ts::unknown-role-set`: invoking dialectic with unregistered role-set throws UnknownRoleSetError with available list.

### Implementation for User Story 4

- [ ] T050 [P] [US4] Create `src/roles/inter-agent.ts` with Player-A, Player-B, Judge prompts and routing logic.
- [ ] T051 [P] [US4] Create `src/roles/multi-critic.ts` with Devil's Advocate, Long-Term Thinker, Cost-Conscious Critic prompts.
- [ ] T052 [US4] Update `src/dialectic.ts` to dispatch on `roleSet` config: canonical (default), inter-agent, multi-critic, or custom registered.
- [ ] T053 [US4] Auto-register inter-agent and multi-critic role-sets in `src/roles/index.ts` initialization.
- [ ] T054 [US4] Run vitest — confirm US4 tests pass.

**Checkpoint**: ✅ User Story 4 complete. Role variants working; registry extensible.

---

## Phase 7: User Story 5 — Provider-agnostic adapter API (Priority: P2)

**Goal**: Custom providers can be registered without modifying core; OpenRouter and Anthropic adapters are reference implementations.

**Independent Test**: `tests/integration/dialectic.test.ts::custom-provider` registers a contrived adapter, runs the dialectic with it, verifies success.

### Tests for User Story 5

- [ ] T055 [P] [US5] Integration test `tests/integration/dialectic.test.ts::custom-provider`: register custom adapter, run dialectic, verify it's used for all calls.
- [ ] T056 [P] [US5] Unit test `tests/unit/providers.test.ts::openrouter-429-retry`: simulate 429s, verify backoff sequence 15/30/45s and retry success on 4th call (or fail with 3 attempts).
- [ ] T057 [P] [US5] Unit test `tests/unit/providers.test.ts::adapter-error-wrapping`: adapter throw is wrapped in ProviderError with provider name + model + round + role.

### Implementation for User Story 5

- [ ] T058 [US5] Verify `OpenRouterAdapter` (T023) implements 429 retry with backoff per spec FR-005.
- [ ] T059 [US5] Verify `AnthropicAdapter` (T024) wraps SDK errors in ProviderError.
- [ ] T060 [US5] Add a `examples/custom-provider.ts` example showing how to register and use a custom adapter.
- [ ] T061 [US5] Document provider adapter contract in `specs/001-runcor-dialectic-core/contracts/provider-adapter.md`.
- [ ] T062 [US5] Run vitest — confirm US5 tests pass.

**Checkpoint**: ✅ User Story 5 complete. Provider-agnostic API verified.

---

## Phase 8: User Story 6 — 15-problem benchmark as runnable example (Priority: P2)

**Goal**: `npm run example:15-problems` reproduces the v2 prototype's 93%/25%-cost claim.

**Independent Test**: With OPENROUTER_API_KEY set, the command runs all 15 problems, writes results JSON, prints summary with material accuracy ≥93%.

### Tests for User Story 6

- [ ] T063 [P] [US6] Integration test `tests/regression/15-problems-benchmark.test.ts` (opt-in via env var): runs benchmark, asserts material accuracy ≥93%, asserts cost ≤30% of Claude baseline cost.
- [ ] T064 [P] [US6] Unit test `tests/unit/example-cli.test.ts`: missing OPENROUTER_API_KEY produces clear error message and non-zero exit.

### Implementation for User Story 6

- [ ] T065 [P] [US6] Create `examples/problems.ts` migrating 15 problem definitions from `C:\runcor_dialectic\problems.js`.
- [ ] T066 [P] [US6] Create `examples/15-problems.ts`: load problems, run dialectic on each, run baseline (Claude) on each, compute material accuracy + cost, write `examples/15-problems-results.json`, print summary.
- [ ] T067 [US6] Wire `npm run example:15-problems` script in package.json.
- [ ] T068 [US6] Run example end-to-end against live OpenRouter (with key) and verify SC-001 / SC-002 / SC-003 pass.

**Checkpoint**: ✅ User Story 6 complete. Benchmark reproducible.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T069 [P] Generate API docs from TS types into `docs/api.md`.
- [ ] T070 [P] Write `docs/convergence.md` explaining the convergence-integrity fix vs v2.
- [ ] T071 [P] Write `specs/001-runcor-dialectic-core/quickstart.md` (5-minute getting-started).
- [ ] T072 [P] Write `specs/001-runcor-dialectic-core/data-model.md` documenting all types.
- [ ] T073 [P] Write `specs/001-runcor-dialectic-core/contracts/dialectic-api.md`, `provider-adapter.md`, `role-registry.md`.
- [ ] T074 Run full vitest suite (unit + integration + regression). Confirm coverage gates: ≥80% global, 100% on `src/convergence.ts`.
- [ ] T075 Run `npm run build` — verify dist/ produced with .d.ts files.
- [ ] T076 Manual end-to-end test: install the built tarball into a fresh dir, run quickstart.md verbatim, verify it works.
- [ ] T077 Create `runcor-ai/runcor-dialectic` GitHub repo, push initial commit, tag `v0.1.0`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)** → no dependencies
- **Phase 2 (Foundational)** → depends on Phase 1; BLOCKS all user stories
- **Phase 3-8 (US1-US6)** → all depend on Phase 2
  - US1 → US2 (US2 builds on US1's dialectic loop)
  - US3 → can run parallel to US2 once US1 done
  - US4, US5, US6 → all parallel after US1+US2+US3 complete
- **Phase 9 (Polish)** → depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Foundational only; provides the loop
- **US2 (P1)**: Depends on US1 (modifies the loop's convergence step)
- **US3 (P1)**: Depends on US1 (adds budget tracking to the loop)
- **US4 (P2)**: Depends on US1 (uses the loop with different role-sets)
- **US5 (P2)**: Depends on US1 (adapters wrap calls)
- **US6 (P2)**: Depends on US1+US2+US3 (the benchmark needs the validated loop)

### Within Each User Story

- Tests written first (per Constitution Quality Gates)
- Models/types/adapters before logic that uses them
- Logic before examples that demonstrate it

### Parallel Opportunities

- All [P] tasks in Phase 1 (Setup) can run in parallel
- All [P] tasks in Phase 2 (Foundational) can run in parallel
- US4, US5, US6 can run in parallel after US1+US2+US3 complete
- All Polish tasks marked [P] can run in parallel

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 → Phase 2 → US1 (T020-T030)
2. STOP. Validate: library is importable, dialectic() callable, returns audited result with mock provider.
3. This is the minimum shippable artifact — proves the standalone-sibling claim.

### Incremental Delivery

1. MVP → ship as v0.1.0-alpha (internal)
2. Add US2 (convergence integrity) → v0.2.0-alpha
3. Add US3 (cost transparency) → v0.3.0-alpha
4. Add US4+US5+US6 in parallel → v1.0.0
5. Polish + GitHub push → v1.0.0 public release

### No Parallel Team

Single-developer build (Claude executing tasks sequentially). Parallelism is logical (independent code paths can be implemented in any order) not temporal.

---

## Notes

- [P] tasks = different files, no dependencies — can be batched in a single message when invoked
- [Story] label maps task to user story for traceability and post-implementation review
- Tests written before implementation (per Constitution Quality Gate)
- Commit after each task or logical group (suggested: per-phase commits)
- Stop at each Phase Checkpoint to validate before proceeding
- Avoid: vague tasks, shared-file conflicts, cross-story dependencies that break US independence

**Total tasks**: 77
**Estimated effort**: 2-3 days for a single developer with full context (which Claude has via the prototype + memory)
