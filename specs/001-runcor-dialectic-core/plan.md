# Implementation Plan: runcor-dialectic v1.0 — Core Library

**Branch**: `001-runcor-dialectic-core` | **Date**: 2026-05-03 | **Spec**: ./spec.md
**Input**: Feature specification from `/specs/001-runcor-dialectic-core/spec.md`

## Summary

Package the existing `C:\runcor_dialectic\` JavaScript prototype as a clean, standalone TypeScript npm sibling repo in the runcor-ai family. Preserve the validated Player/Coach/Judge dialectic semantics while fixing the documented early-convergence bug (Problems 4 & 15), adding a role registry for variant role-sets (inter-agent, multi-critic), exposing a provider adapter interface (OpenRouter + Anthropic bundled), and shipping the 15-problem benchmark as a runnable example. Zero changes to any other runcor-ai sibling repo.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js >= 20.6.0
**Primary Dependencies**:
- Runtime: `dotenv` (env loading), native `fetch` (OpenRouter HTTP), `@anthropic-ai/sdk` (Claude baseline only — used by benchmark, not core)
- Dev: `vitest` (test framework), `tsup` (bundler), `typescript`, `@types/node`
- No transitive dependencies beyond the four runtime + four dev above.

**Storage**: None. The library is stateless — each `dialectic()` call is independent. Transcripts returned to caller; persistence is consumer's responsibility.

**Testing**: Vitest (matches runcor sibling convention). Three test tiers in `tests/`:
- `unit/` — per-function tests of convergence logic, cost computation, role registry, provider adapters with mock providers
- `integration/` — full dialectic runs against a deterministic mock provider
- `regression/` — Problems 4 (Ghost Employee) and 15 (Autonomous Shutdown) from v2 benchmark, plus full 15-problem suite (live OpenRouter, opt-in via env var)

**Target Platform**: Node.js library (CommonJS + ESM dual export via tsup). No browser bundle in v1.0.

**Project Type**: Library (single project, no frontend/backend split).

**Performance Goals**:
- Median dialectic call ≤60s wall-clock against OpenRouter (matches v2 prototype).
- Library overhead (excluding model API calls) ≤50ms per round.
- Library bundle size ≤30KB minified (no heavy deps).

**Constraints**:
- MUST NOT modify any other runcor-ai sibling repo.
- MUST regression-test Problems 4 and 15 on every release.
- MUST achieve ≥93% material accuracy on 15-problem benchmark.
- TypeScript strict mode enforced.

**Scale/Scope**:
- Single feature in v1.0 (this spec). No multi-tenant, no concurrent dialectic sessions to coordinate, no persistent state.
- Library API surface ≤5 exported symbols.
- Estimated source size: ~800 lines of TypeScript across 8-10 files.

## Constitution Check

| Principle | Compliance | Evidence |
|---|---|---|
| **I. Standalone Sibling First** (NON-NEGOTIABLE) | ✅ PASS | No dependency on or modification of any runcor sibling. Independent `package.json`. Optional adapters for sibling integration documented but not in core. |
| **II. Convergence Integrity** (NON-NEGOTIABLE) | ✅ PASS | Two-mechanism fix designed: (a) Coach must enumerate "no objection on data, options, framing" before CONVERGED accepted; (b) Judge has incorporation-veto re-running Coach when final answer fails to incorporate raised concerns. Regression tests for Problems 4 & 15 in `tests/regression/`. |
| **III. Audit Trail Preservation** | ✅ PASS | `Round` type captures every model call with role, model, content, tokens, cost, duration, timestamp. `DialecticResult.transcript` returns full sequence — no summarization. |
| **IV. Cost Transparency** | ✅ PASS | Per-round `cost_usd` computed at call time using configurable per-model price tables. `DialecticResult.cost.usd` is exact sum. `budget_cap_usd` parameter supported. |
| **V. Provider Agnosticism** | ✅ PASS | `ProviderAdapter` interface in `src/types.ts`. Bundled adapters `OpenRouterAdapter` and `AnthropicAdapter` in `src/providers/`. `registerProvider(name, adapter)` exposed for custom providers. Core dialectic logic depends only on the interface. |

**No violations.** No entries in Complexity Tracking required.

## Project Structure

### Documentation (this feature)

```text
specs/001-runcor-dialectic-core/
├── plan.md              # This file
├── spec.md              # Feature specification
├── tasks.md             # Task breakdown (next phase)
├── research.md          # Decisions log (created during implementation)
├── data-model.md        # Type definitions reference (created during implementation)
├── quickstart.md        # 5-minute getting-started guide (created during implementation)
└── contracts/
    ├── dialectic-api.md       # Public API contract
    ├── provider-adapter.md    # Provider adapter interface contract
    └── role-registry.md       # Role registry contract
```

### Source Code (repository root)

```text
runcor-dialectic/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── CLAUDE.md
├── LICENSE
├── .gitignore
├── .env.example
├── src/
│   ├── index.ts                    # Public API: dialectic, registerRole, registerProvider, types
│   ├── dialectic.ts                # Main loop: Player → Coach → revise → check convergence → loop
│   ├── convergence.ts              # Coach-enumeration check + Judge incorporation-veto logic
│   ├── cost.ts                     # Per-model price tables + cost computation
│   ├── roles/
│   │   ├── index.ts                # Role registry (registerRole, getRoleSet)
│   │   ├── canonical.ts            # Default Player/Coach/Judge prompts
│   │   ├── multi-critic.ts         # Devil's Advocate, Long-Term, Cost-Conscious
│   │   └── inter-agent.ts          # Player-A/Player-B/Judge for cross-agent convergence
│   ├── providers/
│   │   ├── index.ts                # Provider registry (registerProvider, getProvider)
│   │   ├── openrouter.ts           # OpenRouterAdapter (default for Player/Coach/Judge)
│   │   ├── anthropic.ts            # AnthropicAdapter (default for Claude baseline)
│   │   └── mock.ts                 # MockAdapter (for tests)
│   ├── types.ts                    # All public types: DialecticConfig, RoleConfig, Round, DialecticResult, ProviderAdapter, RoleSet
│   └── errors.ts                   # Typed errors: ProviderError, ConvergenceError, BudgetExhaustedError, UnknownRoleSetError
├── tests/
│   ├── unit/
│   │   ├── convergence.test.ts
│   │   ├── cost.test.ts
│   │   ├── roles.test.ts
│   │   └── providers.test.ts
│   ├── integration/
│   │   ├── dialectic.test.ts       # Full loop with MockAdapter
│   │   └── role-variants.test.ts   # Inter-agent + multi-critic with MockAdapter
│   └── regression/
│       ├── problem-04-ghost-employee.test.ts
│       ├── problem-15-autonomous-shutdown.test.ts
│       └── 15-problems-benchmark.test.ts  # Opt-in via OPENROUTER_API_KEY
├── examples/
│   ├── 15-problems.ts              # The benchmark runner (npm run example:15-problems)
│   ├── problems.ts                 # The 15 problem definitions (migrated from prototype)
│   └── single-call.ts              # Minimal example (npm run example:single-call)
└── docs/
    ├── api.md                      # Generated API docs
    └── convergence.md              # Explainer on the convergence-integrity fix
```

**Structure Decision**: Single-project library layout, matches the runcor-memory and runcor-substrate sibling conventions. No CLI, no web service. The library is consumed via `import { dialectic } from 'runcor-dialectic'` and returns plain objects with no side effects beyond model API calls.

## Complexity Tracking

> No Constitution Check violations. This section intentionally empty.
