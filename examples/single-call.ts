// Minimal example: invoke the dialectic against any problem and print the result.
//
// Usage:
//   npm run example:single-call -- "Your arbitrary problem text here"
//   echo "Your problem" | npm run example:single-call
//   npm run example:single-call          (uses a built-in default problem)
//
// Setup: cp .env.example → .env, add OPENROUTER_API_KEY.

import 'dotenv/config';
import { dialectic } from '../src/index.js';

const DEFAULT_PROBLEM = `A customer support agent is reviewing billing complaints.

CUSTOMER: "I was charged twice for my $49 subscription this month."

LOG: Two $49 charges on March 1 (both succeeded). One $49 refund on March 1 (succeeded). Account balance: $0. Status: active.

Question: Is the complaint valid? What should we tell the customer?`;

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main(): Promise<void> {
  if (!process.env['OPENROUTER_API_KEY']) {
    console.error('ERROR: OPENROUTER_API_KEY not set. Copy .env.example → .env and add your key.');
    process.exit(1);
  }

  // Resolve problem text from: CLI args > stdin > built-in default
  const args = process.argv.slice(2);
  const cliProblem = args.length > 0 ? args.join(' ') : '';
  const stdinProblem = await readStdin();
  const problem = cliProblem || stdinProblem || DEFAULT_PROBLEM;
  const source =
    cliProblem ? 'CLI args' :
    stdinProblem ? 'stdin' :
    'built-in default';

  console.log(`\n=== Dialectic (problem from ${source}, ${problem.length} chars) ===\n`);

  const result = await dialectic({ problem, maxRounds: 3 });

  console.log(`\n--- ANSWER ---\n${result.answer}\n`);
  console.log(`--- META ---`);
  console.log(`Converged: ${result.converged} (${result.convergence_reason})`);
  console.log(`Rounds: ${result.rounds}`);
  console.log(`Cost: $${result.cost.usd.toFixed(4)} (${result.cost.tokens.input} in + ${result.cost.tokens.output} out tokens)`);
  console.log(`Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
  console.log(`Transcript entries: ${result.transcript.length}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
