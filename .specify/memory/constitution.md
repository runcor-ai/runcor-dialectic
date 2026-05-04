<!--
Sync Impact Report
==================
Version change: 0.0.0 → 1.0.0 (initial ratification)
Modified principles: N/A (initial)
Added sections: All (initial constitution)
Removed sections: N/A
Templates requiring updates:
  ✅ .specify/templates/spec-template.md (compatible — no changes needed)
  ✅ .specify/templates/plan-template.md (compatible — no changes needed)
  ✅ .specify/templates/tasks-template.md (compatible — no changes needed)
Follow-up TODOs: None
-->

# runcor-dialectic Constitution

## Core Principles

### I. Standalone Sibling First (NON-NEGOTIABLE)

`runcor-dialectic` MUST be a standalone, independently testable, independently consumable Node.js package. It MUST NOT modify any existing repo in the runcor-ai family (runcor, runcor-substrate, runcor-memory, runcor-data, runcor-integration, autonomous-company-engine). All integration with other runcor siblings MUST happen through documented hooks (constructor injection, factory params, optional adapters), never through code changes to those siblings.

Rationale: The runcor build methodology requires that every component be useful and consumable on its own before being folded into downstream consumers. This is how runcor-memory, runcor-substrate, runcor-data, and runcor-integration were built. Folding-in is a separate downstream decision per consumer, not a build prerequisite.

### II. Convergence Integrity (NON-NEGOTIABLE)

The dialectic MUST NOT converge prematurely. Premature convergence is the documented failure mode of the v2 prototype (Problems 4 and 15). Convergence MUST require either:
(a) The Coach explicitly enumerates "no objection on data, no objection on options, no objection on framing" before emitting `CONVERGED`, OR
(b) The Judge has veto power to re-run the Coach with a stronger prompt when the final Player answer fails to incorporate raised concerns.

The implementation MUST regression-test the documented failure-mode problems (Ghost Employee, Autonomous Shutdown) on every release.

Rationale: A dialectic that converges before incorporating valid critique is worse than no dialectic at all — it produces false confidence with cost overhead. Convergence integrity is the load-bearing claim of the entire library.

### III. Audit Trail Preservation

Every dialectic run MUST return a complete transcript: every Player draft, every Coach critique, every Judge convergence score, with model identifiers, token counts, durations, and timestamps. The transcript MUST NOT be collapsed, summarized, or truncated in the return value. Consumers MUST be able to reconstruct the entire reasoning sequence.

Rationale: The dialectic's value is in *how* it reasoned, not just *what* it concluded. Downstream layers (Identity, Goals, Skill consolidation) need to inspect rounds to extract patterns. Hiding the trail destroys the primary leverage of the primitive.

### IV. Cost Transparency

Every dialectic call MUST return a cost breakdown: input tokens, output tokens, and per-model cost in USD. Cost MUST be computed at call time using current per-model pricing, not estimated post-hoc. Consumers MUST be able to gate calls on a budget cap.

Rationale: The dialectic's empirical advantage over single-model calls is "comparable quality at 25% of the cost." That claim is unverifiable without exact cost reporting. Cost transparency is also a precondition for runcor-memory's resource-pressure drive (a future consumer).

### V. Provider Agnosticism

The library MUST be model-provider-agnostic. The default implementation uses OpenRouter for Player/Coach/Judge and Anthropic SDK for Claude baseline, but the API MUST accept any provider via configurable `complete(messages, options) → {content, tokens, cost, duration}` adapters. Adding a new provider MUST NOT require changes to dialectic core logic.

Rationale: Today's best Player model may not be tomorrow's. Lock-in to one provider undermines the library's longevity. Provider-agnosticism is also what allows downstream consumers (runcor engine) to substitute their own model router.

## Quality Gates

- **Test framework**: Vitest (matches runcor sibling convention)
- **Test tiers**: Unit (per-function), integration (full dialectic runs against mock providers), regression (15-problem benchmark + Problems 4 and 15 specifically)
- **Coverage gate**: ≥80% line coverage on `src/`, 100% on convergence-decision code paths
- **Benchmark gate**: 15-problem benchmark MUST achieve ≥93% material accuracy (matching v2 baseline) on every release
- **Convergence regression gate**: Problems 4 and 15 MUST converge on the answer that incorporates the Coach's raised concern (NOT the prematurely-converged answer from v2)
- **Type safety**: TypeScript strict mode (matches runcor sibling convention)
- **No new dependencies** without justification in PR description

## Development Workflow

- Specs live in `specs/NNN-feature-name/` per spec-kit convention
- Each spec MUST link to the constitution principle(s) it depends on
- PR descriptions MUST cite the constitution principles being honored OR justify deviation
- Convergence integrity changes (Principle II) require benchmark re-run before merge
- Cost-affecting changes (Principle IV) require updated cost-tracking tests
- Provider additions (Principle V) require a contract test demonstrating the adapter satisfies the interface

## Governance

This constitution supersedes all other practices for `runcor-dialectic`. Amendments require:
1. A spec under `specs/NNN-amendment-...` describing the change and rationale
2. Approval by the project owner (Jaz Sunda)
3. Version bump per semantic versioning:
   - MAJOR: Principle removal or backward-incompatible redefinition
   - MINOR: Principle addition or material expansion
   - PATCH: Clarifications, wording fixes
4. A migration plan for any backward-incompatible changes

All PRs must verify compliance with the five Core Principles. Complexity must be justified.

**Version**: 1.0.0 | **Ratified**: 2026-05-03 | **Last Amended**: 2026-05-03
