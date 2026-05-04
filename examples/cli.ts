// CLI: pipe or pass a problem, get a structured-reasoning answer with full audit trail.
//
// Usage:
//   npm run example:cli -- "Your problem text here"
//   echo "Your problem" | npm run example:cli
//   cat problem.txt | npm run example:cli
//   npm run example:cli -- --transcript "Show full transcript not just answer"
//   npm run example:cli -- --json "Output JSON instead of human text"
//   npm run example:cli -- --max-rounds=2 "limit rounds"
//   npm run example:cli -- --role-set=multi-critic "use multi-critic instead of canonical"

import 'dotenv/config';
import { dialectic } from '../src/index.js';

interface Flags {
  transcript: boolean;
  json: boolean;
  maxRounds: number;
  roleSet: string;
  budgetCap?: number;
  positional: string[];
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {
    transcript: false,
    json: false,
    maxRounds: 5,
    roleSet: 'canonical',
    positional: [],
  };
  for (const arg of argv) {
    if (arg === '--transcript' || arg === '-t') flags.transcript = true;
    else if (arg === '--json' || arg === '-j') flags.json = true;
    else if (arg.startsWith('--max-rounds=')) flags.maxRounds = parseInt(arg.split('=')[1] ?? '5', 10);
    else if (arg.startsWith('--role-set=')) flags.roleSet = arg.split('=')[1] ?? 'canonical';
    else if (arg.startsWith('--budget-cap=')) flags.budgetCap = parseFloat(arg.split('=')[1] ?? '0');
    else if (!arg.startsWith('--')) flags.positional.push(arg);
  }
  return flags;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function printUsage(): void {
  console.error(`runcor-dialectic CLI

Usage:
  cli "Your problem text"
  echo "Your problem" | cli
  cat problem.txt | cli

Flags:
  --transcript, -t            Show the full audit trail, not just the answer
  --json, -j                  Output structured JSON instead of human-readable text
  --max-rounds=N              Cap coach rounds (default 5)
  --role-set=NAME             canonical | inter-agent | multi-critic (default canonical)
  --budget-cap=USD            Hard budget cap (terminates if exceeded)

Setup:
  cp .env.example .env && add OPENROUTER_API_KEY
`);
}

async function main(): Promise<void> {
  if (!process.env['OPENROUTER_API_KEY']) {
    console.error('ERROR: OPENROUTER_API_KEY not set. cp .env.example → .env and add your key.');
    process.exit(1);
  }

  const flags = parseArgs(process.argv.slice(2));
  const cliProblem = flags.positional.join(' ');
  const stdinProblem = await readStdin();
  const problem = cliProblem || stdinProblem;

  if (!problem) {
    printUsage();
    process.exit(2);
  }

  const config: Parameters<typeof dialectic>[0] = {
    problem,
    maxRounds: flags.maxRounds,
    roleSet: flags.roleSet,
  };
  if (flags.budgetCap !== undefined) config.budget_cap_usd = flags.budgetCap;

  const result = await dialectic(config);

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n=== ANSWER ===\n');
  console.log(result.answer);
  console.log('\n=== META ===');
  console.log(`Converged: ${result.converged} (${result.convergence_reason})`);
  console.log(`Role-set: ${flags.roleSet}`);
  console.log(`Rounds: ${result.rounds}`);
  console.log(`Cost: $${result.cost.usd.toFixed(4)} (${result.cost.tokens.input} in + ${result.cost.tokens.output} out tokens)`);
  console.log(`Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
  console.log(`Transcript entries: ${result.transcript.length}`);

  if (flags.transcript) {
    console.log('\n=== TRANSCRIPT ===\n');
    for (const entry of result.transcript) {
      console.log(`--- [${entry.index}] ${entry.role.toUpperCase()} (round ${entry.round}, ${entry.model}, $${entry.cost_usd.toFixed(4)}, ${(entry.duration_ms / 1000).toFixed(1)}s) ---`);
      console.log(entry.content);
      console.log();
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  if (err && typeof err === 'object' && 'partialTranscript' in err) {
    const pt = (err as { partialTranscript?: unknown[] }).partialTranscript;
    if (Array.isArray(pt)) console.error(`Partial transcript: ${pt.length} entries`);
  }
  process.exit(1);
});
