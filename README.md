# runcor-dialectic

> Player / Coach / Judge structured-reasoning dialectic for LLMs.
> Comparable quality to single-model calls at 25% of the cost.

`runcor-dialectic` is the deliberation primitive of the runcor AI runtime family. It runs structured multi-model reasoning over hard problems: a Player drafts an answer, a Coach critiques it against the data, a Judge verifies convergence — with audit trail, cost transparency, and provider-agnostic adapters.

It is the standalone sibling that other runcor components (Identity, Goals, Termination decision, Forward simulation, Skill synthesis, Inter-agent convergence) depend on for cognitive work.

## Install

```bash
npm install runcor-dialectic
# or
pnpm add runcor-dialectic
```

## Quickstart

```ts
import { dialectic } from 'runcor-dialectic';

const result = await dialectic({
  problem: 'A product runner claims 50% time reduction for Customer #1, but Stripe shows $0 revenue and 0 charges. Should the CEO trust the runner?',
  // Use defaults (canonical Player/Coach/Judge with OpenRouter)
});

console.log(result.answer);
console.log(`Converged in ${result.rounds} rounds, cost $${result.cost.usd.toFixed(4)}`);
console.log(`Audit trail: ${result.transcript.length} entries`);
```

Set `OPENROUTER_API_KEY` in your environment for the default models.

## Why a dialectic?

A single LLM call is *thinking*. A dialectic is *thinking hard, with an audit trail and a stopping rule*. On a 15-problem benchmark of business reasoning tasks, the dialectic matches Claude Sonnet 4 quality (93% vs 95% material accuracy) at 25% of the cost — and produces a transcript that downstream layers (memory, identity, goal-discovery) can inspect, not just a final answer.

See [`docs/convergence.md`](./docs/convergence.md) for how the convergence-integrity fix prevents premature convergence — the documented failure mode of the v2 prototype.

## API

```ts
import { dialectic, registerRole, registerProvider } from 'runcor-dialectic';
import type { DialecticConfig, DialecticResult, ProviderAdapter } from 'runcor-dialectic';
```

### `dialectic(config) → Promise<DialecticResult>`

Runs a single dialectic against a problem. Returns the final answer, the complete audit trail, the cost in USD, and convergence metadata.

### `registerRole(name, config)` / `registerProvider(name, adapter)`

Extend the role registry (Devil's Advocate, Long-Term, Cost-Conscious, custom roles) and provider registry (custom model providers).

See [`specs/001-runcor-dialectic-core/spec.md`](./specs/001-runcor-dialectic-core/spec.md) for the full feature spec, [`plan.md`](./specs/001-runcor-dialectic-core/plan.md) for the implementation plan, [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) for the project's governing principles.

## Built-in role-sets

- **canonical** (default) — Player + Coach + Judge
- **inter-agent** — Player-A + Player-B + Judge (for cross-agent convergence on a shared workspace)
- **multi-critic** — Player + Devil's Advocate + Long-Term Thinker + Cost-Conscious + Judge

## Built-in providers

- **openrouter** — default for Player/Coach/Judge (Nemotron 120B, Qwen 3 32B, Llama 3.1 8B)
- **anthropic** — for the Claude Sonnet 4 baseline used in the benchmark
- **mock** — for tests

Custom providers via `registerProvider(name, adapter)`. See [`docs/provider-adapter.md`](./docs/provider-adapter.md).

## Run the benchmark

```bash
cp .env.example .env  # Add OPENROUTER_API_KEY and ANTHROPIC_API_KEY
npm install
npm run example:15-problems
```

Reproduces the v2 prototype's 93%/25%-cost claim. Output: `examples/15-problems-results.json` plus a summary.

## Constitution

This library follows the runcor build methodology: standalone sibling first, fold into consumers later. It does not modify any other runcor-ai sibling repo. See `.specify/memory/constitution.md` for the five governing principles.

## License

MIT — see [`LICENSE`](./LICENSE).

## Part of the runcor family

- [runcor](https://github.com/runcor-ai/runcor) — AI runtime engine
- [runcor-substrate](https://github.com/runcor-ai/runcor-substrate) — Laws + Reality + discernment gate
- [runcor-memory](https://github.com/runcor-ai/runcor-memory) — Long Chain Memory
- [runcor-data](https://github.com/runcor-ai/runcor-data) — Data Fabric
- [runcor-integration](https://github.com/runcor-ai/runcor-integration) — Schema discovery + dynamic tools
- **runcor-dialectic** — Player/Coach/Judge deliberation (this repo)
- [rpp](https://github.com/runcor-ai/rpp) — R++ structured spec language
