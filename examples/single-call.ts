// Minimal example: invoke the dialectic against a problem and print the result.
//
// Setup:
//   1. cp .env.example .env
//   2. Add OPENROUTER_API_KEY to .env
//   3. npm run example:single-call

import 'dotenv/config';
import { dialectic } from '../src/index.js';
import { problems } from './problems.js';

async function main(): Promise<void> {
  if (!process.env['OPENROUTER_API_KEY']) {
    console.error('ERROR: OPENROUTER_API_KEY not set. Copy .env.example → .env and add your key.');
    process.exit(1);
  }

  const problem = problems[0]!; // The Fake Customer
  console.log(`\n=== Running dialectic on: ${problem.name} ===\n`);

  const result = await dialectic({
    problem: problem.prompt,
    maxRounds: 3,
  });

  console.log(`\n--- ANSWER ---\n${result.answer}\n`);
  console.log(`--- META ---`);
  console.log(`Converged: ${result.converged} (${result.convergence_reason})`);
  console.log(`Rounds: ${result.rounds}`);
  console.log(`Cost: $${result.cost.usd.toFixed(4)} (${result.cost.tokens.input} input + ${result.cost.tokens.output} output tokens)`);
  console.log(`Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
  console.log(`Transcript entries: ${result.transcript.length}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
