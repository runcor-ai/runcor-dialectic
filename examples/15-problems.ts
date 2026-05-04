// 15-problem benchmark — reproduces the v2 prototype's "93% material accuracy
// at 25% cost" claim against Claude Sonnet 4 baseline.
//
// NOTE: v0.1.0 ships with 9 of the 15 problems ported from the prototype.
// The other 6 (Pricing Dilemma, Build vs Buy, Market Entry, Ethical Override,
// Conflicting Memories, Autonomous Shutdown) appear in v2 published runs but
// their source prompts aren't in the prototype tree. Will be added in v0.2.
//
// Setup:
//   1. cp .env.example .env
//   2. Add OPENROUTER_API_KEY and ANTHROPIC_API_KEY
//   3. npm install @anthropic-ai/sdk  (already a peerDep, install if missing)
//   4. npm run example:15-problems

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { dialectic, AnthropicAdapter, registerProvider } from '../src/index.js';
import { problems } from './problems.js';

interface BenchmarkRun {
  problem: { id: string; name: string; difficulty: string };
  expected: string;
  dialectic: {
    answer: string;
    rounds: number;
    converged: boolean;
    convergence_reason: string;
    cost_usd: number;
    duration_ms: number;
  };
  baseline: {
    answer: string;
    cost_usd: number;
    duration_ms: number;
  };
}

async function callBaseline(prompt: string): Promise<{ content: string; cost_usd: number; duration_ms: number }> {
  const adapter = new AnthropicAdapter();
  const start = Date.now();
  const res = await adapter.complete([{ role: 'user', content: prompt }], {
    model: 'claude-sonnet-4-20250514',
    maxTokens: 2048,
  });
  return {
    content: res.content,
    cost_usd: res.cost_usd,
    duration_ms: Date.now() - start,
  };
}

async function main(): Promise<void> {
  if (!process.env['OPENROUTER_API_KEY']) {
    console.error('ERROR: OPENROUTER_API_KEY not set. Copy .env.example → .env and add your key.');
    process.exit(1);
  }
  if (!process.env['ANTHROPIC_API_KEY']) {
    console.error('ERROR: ANTHROPIC_API_KEY not set. Required for Claude baseline comparison.');
    process.exit(1);
  }

  // Register Anthropic adapter for the baseline (not auto-registered since SDK is optional peerDep).
  registerProvider(new AnthropicAdapter());

  const runs: BenchmarkRun[] = [];
  let totalDialecticCost = 0;
  let totalBaselineCost = 0;

  console.log(`\n=== runcor-dialectic 15-problem benchmark (${problems.length} problems ported) ===\n`);

  for (let i = 0; i < problems.length; i++) {
    const problem = problems[i]!;
    console.log(`[${i + 1}/${problems.length}] ${problem.name} (${problem.difficulty})`);

    let dialecticResult: BenchmarkRun['dialectic'];
    let baselineResult: BenchmarkRun['baseline'];

    try {
      const r = await dialectic({ problem: problem.prompt, maxRounds: 5 });
      dialecticResult = {
        answer: r.answer,
        rounds: r.rounds,
        converged: r.converged,
        convergence_reason: r.convergence_reason,
        cost_usd: r.cost.usd,
        duration_ms: r.duration_ms,
      };
      totalDialecticCost += r.cost.usd;
      console.log(`  Dialectic: ${r.rounds} rounds, $${r.cost.usd.toFixed(4)}, ${(r.duration_ms / 1000).toFixed(1)}s, converged=${r.converged}`);
    } catch (err) {
      console.error(`  Dialectic ERROR: ${(err as Error).message}`);
      dialecticResult = { answer: `ERROR: ${(err as Error).message}`, rounds: 0, converged: false, convergence_reason: 'error', cost_usd: 0, duration_ms: 0 };
    }

    try {
      const b = await callBaseline(problem.prompt);
      baselineResult = { answer: b.content, cost_usd: b.cost_usd, duration_ms: b.duration_ms };
      totalBaselineCost += b.cost_usd;
      console.log(`  Baseline:  $${b.cost_usd.toFixed(4)}, ${(b.duration_ms / 1000).toFixed(1)}s`);
    } catch (err) {
      console.error(`  Baseline ERROR: ${(err as Error).message}`);
      baselineResult = { answer: `ERROR: ${(err as Error).message}`, cost_usd: 0, duration_ms: 0 };
    }

    runs.push({
      problem: { id: problem.id, name: problem.name, difficulty: problem.difficulty },
      expected: problem.expected,
      dialectic: dialecticResult,
      baseline: baselineResult,
    });

    // Be polite to OpenRouter rate limits between problems
    if (i < problems.length - 1) await new Promise((r) => setTimeout(r, 5000));
  }

  const outFile = 'examples/15-problems-results.json';
  writeFileSync(outFile, JSON.stringify(runs, null, 2));

  console.log(`\n=== SUMMARY ===`);
  console.log(`Problems run: ${runs.length}`);
  console.log(`Total dialectic cost: $${totalDialecticCost.toFixed(4)}`);
  console.log(`Total baseline cost:  $${totalBaselineCost.toFixed(4)}`);
  if (totalBaselineCost > 0) {
    console.log(`Cost ratio: ${((totalDialecticCost / totalBaselineCost) * 100).toFixed(1)}% of baseline`);
  }
  console.log(`\nResults written to: ${outFile}`);
  console.log(`\nMaterial accuracy is human-evaluated — compare each run.dialectic.answer and run.baseline.answer to run.expected.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
