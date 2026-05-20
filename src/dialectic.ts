// Main dialectic loop — Player → Coach → revise → check convergence → loop.
// Implements US1 (audited answer), US2 (convergence integrity), US3 (cost transparency).

import type {
  DialecticConfig,
  DialecticResult,
  ProviderAdapter,
  RoleConfig,
  Round,
  Tokens,
  ConvergenceReason,
} from './types.js';
import {
  ProviderError,
  BudgetExhaustedError,
  UnknownRoleSetError,
} from './errors.js';
import { providerRegistry } from './providers/index.js';
import { roleRegistry, registerRoleSet } from './roles/index.js';
import { canonicalRoleSet } from './roles/canonical.js';
import {
  validateCoachConvergence,
  extractCoachConcerns,
  checkIncorporation,
  checkNovelty,
} from './convergence.js';
import { BudgetTracker, mergePrices } from './cost.js';

// Auto-register canonical role-set on first import.
let _canonicalRegistered = false;
function ensureCanonicalRegistered(): void {
  if (_canonicalRegistered) return;
  registerRoleSet(canonicalRoleSet);
  _canonicalRegistered = true;
}

const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_CONVERGENCE_THRESHOLD = 0.75;

// ─── R++ wrapper builders ────────────────────────────────────────────────────
// Every multi-round message is wrapped in R++ syntax (TARGET / DATA / BEHAVIOR /
// CHECKLIST). The earlier prose wrappers — "Original problem / Your previous
// analysis / Provide your revised analysis" — clobbered the deliverable framing
// because the revision system prompt is the only persistent signal across rounds.
// R++ keeps the deliverable framing consistent at every round.

function rppCoachCritique(problem: string, playerOutput: string): string {
  return `TARGET {
  output: a critique of the player's deliverable per your role's BEHAVIOR rules
  profile: dialectic-coach-critique
}

DATA {
  original_problem:
${indent(problem, 4)}

  deliverable_to_critique:
${indent(playerOutput, 4)}
}`;
}

function rppCoachBareConvergedReprompt(): string {
  return `TARGET {
  output: either a valid CONVERGED block with the required enumeration, or a fresh critique
  profile: dialectic-coach-bare-converged-reprompt
}

BEHAVIOR Required {
  CONSTRAINT: your previous CONVERGED was rejected because the three "no objection" lines were missing
  CONSTRAINT: to emit CONVERGED, state on three separate lines:
    "no objection on data: <reason>"
    "no objection on options: <reason>"
    "no objection on framing: <reason>"
  CONSTRAINT: on the line after those three, emit the literal token: CONVERGED
  CONSTRAINT: if you cannot honestly emit those three lines, do NOT emit CONVERGED — provide a fresh critique instead
}`;
}

function rppPlayerRevisionFromCritique(problem: string, previousDeliverable: string, critique: string): string {
  return `TARGET {
  output: a revised deliverable in the SAME FORMAT as previous_deliverable, incorporating valid critique
  profile: dialectic-player-revision-from-critique
}

DATA {
  original_problem:
${indent(problem, 4)}

  previous_deliverable:
${indent(previousDeliverable, 4)}

  critique:
${indent(critique, 4)}
}`;
}

function rppPlayerRevisionFromMissing(problem: string, previousDeliverable: string, missing: string[]): string {
  const missingList = missing.map((m, i) => `    ${i + 1}. ${m}`).join('\n');
  return `TARGET {
  output: a revised deliverable in the SAME FORMAT as previous_deliverable, with every missing concern reflected in the content
  profile: dialectic-player-revision-from-missing
}

DATA {
  original_problem:
${indent(problem, 4)}

  previous_deliverable:
${indent(previousDeliverable, 4)}

  missing_concerns:
${missingList}
}

BEHAVIOR {
  CONSTRAINT: every numbered missing_concern MUST be reflected in the revised deliverable's content — name the entity, number, or contradiction directly
}`;
}

function rppMultiCriticCritique(problem: string, playerDraft: string, criticRole: string): string {
  return `TARGET {
  output: a critique from the ${criticRole.toUpperCase()} perspective per your role's BEHAVIOR rules
  profile: dialectic-multi-critic-${criticRole}
}

DATA {
  original_problem:
${indent(problem, 4)}

  player_draft:
${indent(playerDraft, 4)}
}`;
}

function rppMultiCriticSynthesis(problem: string, playerDraft: string, critiques: Array<{ role: string; content: string }>): string {
  const critiqueBlocks = critiques.map((c) =>
    `  ${c.role}_critique:\n${indent(c.content, 4)}`
  ).join('\n\n');
  return `TARGET {
  output: the final amended deliverable in the format the original problem requested, with each critic's substantive concern decided
  profile: dialectic-multi-critic-synthesis
}

DATA {
  original_problem:
${indent(problem, 4)}

  player_draft:
${indent(playerDraft, 4)}

${critiqueBlocks}
}

BEHAVIOR Synthesis {
  CONSTRAINT: produce the final deliverable in the format the original_problem requested
  CONSTRAINT: for each substantive critic concern, decide whether to incorporate it; embed incorporated changes into the deliverable itself
  CONSTRAINT: do not output meta-commentary about which critiques were accepted or rejected
}`;
}

function rppInterAgentPlayerB(problem: string, playerAPosition: string): string {
  return `TARGET {
  output: your independent reading of the problem, in the format the problem requested
  profile: dialectic-inter-agent-player-b
}

DATA {
  original_problem:
${indent(problem, 4)}

  player_a_position:
${indent(playerAPosition, 4)}
}

BEHAVIOR {
  CONSTRAINT: provide your own reading; do not summarize player_a
  CONSTRAINT: produce the deliverable in the format the original_problem requested
}`;
}

function rppInterAgentJudge(problem: string, aRes: string, bRes: string): string {
  return `TARGET {
  output: the team's shared resolution of the problem, in the format the problem requested
  profile: dialectic-inter-agent-synthesis
}

DATA {
  original_problem:
${indent(problem, 4)}

  player_a_position:
${indent(aRes, 4)}

  player_b_position:
${indent(bRes, 4)}
}

BEHAVIOR Synthesis {
  CONSTRAINT: produce the shared resolution as the deliverable in the format the original_problem requested
  CONSTRAINT: identify points of agreement and disagreement internally; do not enumerate them as headers in the output
}`;
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((line) => pad + line).join('\n');
}

export async function dialectic(config: DialecticConfig): Promise<DialecticResult> {
  ensureCanonicalRegistered();

  const roleSetName = config.roleSet ?? 'canonical';
  const roleSet = roleRegistry.getRoleSet(roleSetName);
  if (!roleSet) {
    throw new UnknownRoleSetError(roleSetName, roleRegistry.listRoleSets());
  }

  // Apply per-call role overrides
  const effectiveRoles: Record<string, RoleConfig> = { ...roleSet.roles };
  if (config.roles) {
    for (const [name, override] of Object.entries(config.roles)) {
      if (override) effectiveRoles[name] = override;
    }
  }

  const _prices = mergePrices(config.customPrices); // applied via cost.ts when adapter computes
  void _prices;

  // Dispatch on topology — canonical (default), inter-agent, or multi-critic.
  if (roleSet.topology === 'inter-agent') {
    return runInterAgent(config, effectiveRoles);
  }
  if (roleSet.topology === 'multi-critic') {
    return runMultiCritic(config, effectiveRoles);
  }

  // ── Canonical Player/Coach/Judge topology ──
  const playerCfg = effectiveRoles['player'];
  const coachCfg = effectiveRoles['coach'];
  const judgeCfg = effectiveRoles['judge'];
  if (!playerCfg || !coachCfg || !judgeCfg) {
    throw new Error(`Role-set "${roleSetName}" missing required roles for canonical topology. Got: ${Object.keys(effectiveRoles).join(', ')}`);
  }

  const budget = new BudgetTracker(config.budget_cap_usd);

  const playerProvider = resolveProvider(playerCfg.model, 'player');
  const coachProvider = resolveProvider(coachCfg.model, 'coach');
  const judgeProvider = resolveProvider(judgeCfg.model, 'judge');

  const maxRounds = config.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const convergenceThreshold = config.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD;

  const transcript: Round[] = [];
  const totalTokens: Tokens = { input: 0, output: 0 };
  let totalDuration = 0;
  let entryIndex = 0;

  function makeRound(args: {
    round: number;
    role: string;
    model: string;
    content: string;
    tokens: Tokens;
    cost_usd: number;
    duration_ms: number;
  }): Round {
    return {
      index: entryIndex++,
      ...args,
      timestamp: new Date().toISOString(),
    };
  }

  function accumulate(tokens: Tokens, cost_usd: number, duration_ms: number): void {
    totalTokens.input += tokens.input;
    totalTokens.output += tokens.output;
    totalDuration += duration_ms;
    budget.add(cost_usd);
  }

  function checkBudget(estimatedNext: number, partialTranscript: Round[]): void {
    if (budget.wouldExceed(estimatedNext)) {
      throw new BudgetExhaustedError(budget.cap ?? 0, budget.total + estimatedNext, partialTranscript);
    }
  }

  // ── Round 0: Player initial draft ──
  const playerInit = await callProvider(
    playerProvider,
    [{ role: 'system', content: playerCfg.systemPrompt }, { role: 'user', content: config.problem }],
    playerCfg,
    'player',
    0,
    transcript,
  );
  transcript.push(makeRound({
    round: 0,
    role: 'player',
    model: playerCfg.model,
    content: playerInit.content,
    tokens: playerInit.tokens,
    cost_usd: playerInit.cost_usd,
    duration_ms: playerInit.duration_ms,
  }));
  accumulate(playerInit.tokens, playerInit.cost_usd, playerInit.duration_ms);

  let convergenceReason: ConvergenceReason = 'max-rounds';
  let converged = false;
  let coachRounds = 0;
  let lastPlayerContent = playerInit.content;
  const previousCritiques: string[] = [];
  const allConcerns: string[] = [];

  for (let r = 0; r < maxRounds; r++) {
    coachRounds = r + 1;

    // Budget pre-check (rough estimate: 0.5x cost of a player call)
    checkBudget(playerInit.cost_usd * 0.5, transcript);
    if (budget.cap !== undefined && budget.total > budget.cap) {
      convergenceReason = 'budget-exhausted';
      converged = false;
      break;
    }

    // Coach critique (with one re-prompt if bare CONVERGED detected)
    const coachMsg = [
      { role: 'system' as const, content: coachCfg.systemPrompt },
      { role: 'user' as const, content: rppCoachCritique(config.problem, lastPlayerContent) },
    ];
    let coachRes = await callProvider(coachProvider, coachMsg, coachCfg, 'coach', r, transcript);
    let validation = validateCoachConvergence(coachRes.content);

    // If Coach emitted bare CONVERGED, re-prompt once with stronger instruction
    if (validation.bare) {
      const followUp = [
        ...coachMsg,
        { role: 'assistant' as const, content: coachRes.content },
        { role: 'user' as const, content: rppCoachBareConvergedReprompt() },
      ];
      coachRes = await callProvider(coachProvider, followUp, coachCfg, 'coach', r, transcript);
      validation = validateCoachConvergence(coachRes.content);
    }

    transcript.push(makeRound({
      round: r,
      role: 'coach',
      model: coachCfg.model,
      content: coachRes.content,
      tokens: coachRes.tokens,
      cost_usd: coachRes.cost_usd,
      duration_ms: coachRes.duration_ms,
    }));
    accumulate(coachRes.tokens, coachRes.cost_usd, coachRes.duration_ms);

    // Collect concerns from this critique (used for incorporation veto later)
    const newConcerns = extractCoachConcerns(coachRes.content);
    allConcerns.push(...newConcerns);

    // Convergence path A: Coach validly emitted CONVERGED with enumeration
    if (validation.valid) {
      // Final incorporation check on the LAST player content
      const inc = await checkIncorporation(allConcerns, lastPlayerContent, judgeProvider, providerRegistry.parseModel(judgeCfg.model).model);
      transcript.push(makeRound({
        round: r,
        role: 'judge',
        model: judgeCfg.model,
        content: `INCORPORATION CHECK on Coach-converged: incorporated=${inc.incorporated}; missing=${JSON.stringify(inc.missing)}; reason="${inc.reason}"`,
        tokens: inc.judgeTokens,
        cost_usd: inc.judgeCost_usd,
        duration_ms: inc.judgeDuration_ms,
      }));
      accumulate(inc.judgeTokens, inc.judgeCost_usd, inc.judgeDuration_ms);
      if (inc.incorporated) {
        convergenceReason = 'coach-converged-validated';
        converged = true;
        break;
      }
      // Coach said converged but Player didn't incorporate — VETO. Continue with another round.
      previousCritiques.push(coachRes.content);
      // Force a stronger Player revision
      const reviseMsg = [
        { role: 'system' as const, content: playerCfg.revisionSystemPrompt ?? playerCfg.systemPrompt },
        { role: 'user' as const, content: rppPlayerRevisionFromMissing(config.problem, lastPlayerContent, inc.missing) },
      ];
      const reviseRes = await callProvider(playerProvider, reviseMsg, playerCfg, 'player', r + 1, transcript);
      transcript.push(makeRound({
        round: r + 1,
        role: 'player',
        model: playerCfg.model,
        content: reviseRes.content,
        tokens: reviseRes.tokens,
        cost_usd: reviseRes.cost_usd,
        duration_ms: reviseRes.duration_ms,
      }));
      accumulate(reviseRes.tokens, reviseRes.cost_usd, reviseRes.duration_ms);
      lastPlayerContent = reviseRes.content;
      // Loop continues — next iteration will re-check
      convergenceReason = 'judge-incorporation-vetoed';
      continue;
    }

    // Convergence path B: Judge novelty score
    const novelty = await checkNovelty(coachRes.content, previousCritiques, judgeProvider, providerRegistry.parseModel(judgeCfg.model).model);
    transcript.push(makeRound({
      round: r,
      role: 'judge',
      model: judgeCfg.model,
      content: `NOVELTY SCORE: ${novelty.score.toFixed(2)} — ${novelty.reason}`,
      tokens: novelty.judgeTokens,
      cost_usd: novelty.judgeCost_usd,
      duration_ms: novelty.judgeDuration_ms,
    }));
    accumulate(novelty.judgeTokens, novelty.judgeCost_usd, novelty.judgeDuration_ms);

    if (novelty.score >= convergenceThreshold) {
      // Run incorporation check before declaring convergence
      const inc = await checkIncorporation(allConcerns, lastPlayerContent, judgeProvider, providerRegistry.parseModel(judgeCfg.model).model);
      transcript.push(makeRound({
        round: r,
        role: 'judge',
        model: judgeCfg.model,
        content: `INCORPORATION CHECK on novelty-converged: incorporated=${inc.incorporated}; missing=${JSON.stringify(inc.missing)}; reason="${inc.reason}"`,
        tokens: inc.judgeTokens,
        cost_usd: inc.judgeCost_usd,
        duration_ms: inc.judgeDuration_ms,
      }));
      accumulate(inc.judgeTokens, inc.judgeCost_usd, inc.judgeDuration_ms);
      if (inc.incorporated) {
        convergenceReason = 'judge-novelty';
        converged = true;
        break;
      }
      // Veto: continue forcing revision
      previousCritiques.push(coachRes.content);
      const reviseMsg = [
        { role: 'system' as const, content: playerCfg.revisionSystemPrompt ?? playerCfg.systemPrompt },
        { role: 'user' as const, content: rppPlayerRevisionFromMissing(config.problem, lastPlayerContent, inc.missing) },
      ];
      const reviseRes = await callProvider(playerProvider, reviseMsg, playerCfg, 'player', r + 1, transcript);
      transcript.push(makeRound({
        round: r + 1,
        role: 'player',
        model: playerCfg.model,
        content: reviseRes.content,
        tokens: reviseRes.tokens,
        cost_usd: reviseRes.cost_usd,
        duration_ms: reviseRes.duration_ms,
      }));
      accumulate(reviseRes.tokens, reviseRes.cost_usd, reviseRes.duration_ms);
      lastPlayerContent = reviseRes.content;
      convergenceReason = 'judge-incorporation-vetoed';
      continue;
    }

    // No convergence — Player revises
    previousCritiques.push(coachRes.content);
    const reviseMsg = [
      { role: 'system' as const, content: playerCfg.revisionSystemPrompt ?? playerCfg.systemPrompt },
      { role: 'user' as const, content: rppPlayerRevisionFromCritique(config.problem, lastPlayerContent, coachRes.content) },
    ];
    const reviseRes = await callProvider(playerProvider, reviseMsg, playerCfg, 'player', r + 1, transcript);
    transcript.push(makeRound({
      round: r + 1,
      role: 'player',
      model: playerCfg.model,
      content: reviseRes.content,
      tokens: reviseRes.tokens,
      cost_usd: reviseRes.cost_usd,
      duration_ms: reviseRes.duration_ms,
    }));
    accumulate(reviseRes.tokens, reviseRes.cost_usd, reviseRes.duration_ms);
    lastPlayerContent = reviseRes.content;
  }

  // If we exited the loop without converging, set a more specific reason
  if (!converged && convergenceReason === 'judge-incorporation-vetoed') {
    convergenceReason = 'max-rounds-without-incorporation';
  }

  return {
    answer: lastPlayerContent,
    transcript,
    rounds: coachRounds,
    converged,
    convergence_reason: convergenceReason,
    cost: { usd: budget.total, tokens: totalTokens },
    duration_ms: totalDuration,
  };
}

// ── Topology: multi-critic ──────────────────────────────────────────────────
// Player drafts → each critic critiques (in sequence to be polite to rate limits)
// → Judge synthesizes a final amended position incorporating each critic.

async function runMultiCritic(
  config: DialecticConfig,
  effectiveRoles: Record<string, RoleConfig>,
): Promise<DialecticResult> {
  const playerCfg = effectiveRoles['player'];
  const judgeCfg = effectiveRoles['judge'];
  if (!playerCfg || !judgeCfg) {
    throw new Error(`multi-critic role-set missing required roles: player and judge`);
  }
  // Critics are every role that isn't player or judge
  const criticEntries = Object.entries(effectiveRoles).filter(
    ([name]) => name !== 'player' && name !== 'judge',
  );
  if (criticEntries.length === 0) {
    throw new Error(`multi-critic role-set has no critics — at least one critic role required`);
  }

  const budget = new BudgetTracker(config.budget_cap_usd);
  const transcript: Round[] = [];
  const totalTokens: Tokens = { input: 0, output: 0 };
  let totalDuration = 0;
  let entryIndex = 0;

  const playerProvider = resolveProvider(playerCfg.model, 'player');
  const judgeProvider = resolveProvider(judgeCfg.model, 'judge');

  function pushRound(args: { round: number; role: string; model: string; content: string; tokens: Tokens; cost_usd: number; duration_ms: number; }): void {
    transcript.push({
      index: entryIndex++,
      ...args,
      timestamp: new Date().toISOString(),
    });
    totalTokens.input += args.tokens.input;
    totalTokens.output += args.tokens.output;
    totalDuration += args.duration_ms;
    budget.add(args.cost_usd);
  }

  function checkBudget(estimatedNext: number): void {
    if (budget.wouldExceed(estimatedNext)) {
      throw new BudgetExhaustedError(budget.cap ?? 0, budget.total + estimatedNext, transcript);
    }
  }

  // Round 0: Player drafts
  const playerInit = await callProvider(
    playerProvider,
    [{ role: 'system', content: playerCfg.systemPrompt }, { role: 'user', content: config.problem }],
    playerCfg, 'player', 0, transcript,
  );
  pushRound({
    round: 0, role: 'player', model: playerCfg.model,
    content: playerInit.content, tokens: playerInit.tokens,
    cost_usd: playerInit.cost_usd, duration_ms: playerInit.duration_ms,
  });

  // Each critic critiques the Player's draft (sequential, not parallel — be polite to rate limits)
  const critiques: Array<{ role: string; content: string }> = [];
  for (const [criticName, criticCfg] of criticEntries) {
    checkBudget(playerInit.cost_usd);
    const criticProvider = resolveProvider(criticCfg.model, criticName);
    const res = await callProvider(
      criticProvider,
      [
        { role: 'system', content: criticCfg.systemPrompt },
        { role: 'user', content: rppMultiCriticCritique(config.problem, playerInit.content, criticName) },
      ],
      criticCfg, criticName, 0, transcript,
    );
    pushRound({
      round: 0, role: criticName, model: criticCfg.model,
      content: res.content, tokens: res.tokens,
      cost_usd: res.cost_usd, duration_ms: res.duration_ms,
    });
    critiques.push({ role: criticName, content: res.content });
  }

  // Judge synthesizes
  checkBudget(playerInit.cost_usd);
  const judgePrompt = rppMultiCriticSynthesis(config.problem, playerInit.content, critiques);
  const judgeRes = await callProvider(
    judgeProvider,
    [
      { role: 'system', content: judgeCfg.systemPrompt },
      { role: 'user', content: judgePrompt },
    ],
    judgeCfg, 'judge', 0, transcript,
  );
  pushRound({
    round: 0, role: 'judge', model: judgeCfg.model,
    content: judgeRes.content, tokens: judgeRes.tokens,
    cost_usd: judgeRes.cost_usd, duration_ms: judgeRes.duration_ms,
  });

  return {
    answer: judgeRes.content,
    transcript,
    rounds: 1,
    converged: true,
    convergence_reason: 'single-pass-synthesized',
    cost: { usd: budget.total, tokens: totalTokens },
    duration_ms: totalDuration,
  };
}

// ── Topology: inter-agent ───────────────────────────────────────────────────
// Player-A drafts → Player-B drafts (sees A's position) → Judge synthesizes.
// Used for cross-agent convergence on a shared workspace.

async function runInterAgent(
  config: DialecticConfig,
  effectiveRoles: Record<string, RoleConfig>,
): Promise<DialecticResult> {
  const playerACfg = effectiveRoles['player-a'];
  const playerBCfg = effectiveRoles['player-b'];
  const judgeCfg = effectiveRoles['judge'];
  if (!playerACfg || !playerBCfg || !judgeCfg) {
    throw new Error(`inter-agent role-set missing required roles: player-a, player-b, judge`);
  }

  const budget = new BudgetTracker(config.budget_cap_usd);
  const transcript: Round[] = [];
  const totalTokens: Tokens = { input: 0, output: 0 };
  let totalDuration = 0;
  let entryIndex = 0;

  const playerAProvider = resolveProvider(playerACfg.model, 'player-a');
  const playerBProvider = resolveProvider(playerBCfg.model, 'player-b');
  const judgeProvider = resolveProvider(judgeCfg.model, 'judge');

  function pushRound(args: { round: number; role: string; model: string; content: string; tokens: Tokens; cost_usd: number; duration_ms: number; }): void {
    transcript.push({
      index: entryIndex++,
      ...args,
      timestamp: new Date().toISOString(),
    });
    totalTokens.input += args.tokens.input;
    totalTokens.output += args.tokens.output;
    totalDuration += args.duration_ms;
    budget.add(args.cost_usd);
  }

  function checkBudget(estimatedNext: number): void {
    if (budget.wouldExceed(estimatedNext)) {
      throw new BudgetExhaustedError(budget.cap ?? 0, budget.total + estimatedNext, transcript);
    }
  }

  // Player-A drafts
  const aRes = await callProvider(
    playerAProvider,
    [{ role: 'system', content: playerACfg.systemPrompt }, { role: 'user', content: config.problem }],
    playerACfg, 'player-a', 0, transcript,
  );
  pushRound({
    round: 0, role: 'player-a', model: playerACfg.model,
    content: aRes.content, tokens: aRes.tokens,
    cost_usd: aRes.cost_usd, duration_ms: aRes.duration_ms,
  });

  // Player-B sees A's position and drafts
  checkBudget(aRes.cost_usd);
  const bRes = await callProvider(
    playerBProvider,
    [
      { role: 'system', content: playerBCfg.systemPrompt },
      { role: 'user', content: rppInterAgentPlayerB(config.problem, aRes.content) },
    ],
    playerBCfg, 'player-b', 0, transcript,
  );
  pushRound({
    round: 0, role: 'player-b', model: playerBCfg.model,
    content: bRes.content, tokens: bRes.tokens,
    cost_usd: bRes.cost_usd, duration_ms: bRes.duration_ms,
  });

  // Judge synthesizes
  checkBudget(aRes.cost_usd);
  const judgePrompt = rppInterAgentJudge(config.problem, aRes.content, bRes.content);
  const judgeRes = await callProvider(
    judgeProvider,
    [{ role: 'system', content: judgeCfg.systemPrompt }, { role: 'user', content: judgePrompt }],
    judgeCfg, 'judge', 0, transcript,
  );
  pushRound({
    round: 0, role: 'judge', model: judgeCfg.model,
    content: judgeRes.content, tokens: judgeRes.tokens,
    cost_usd: judgeRes.cost_usd, duration_ms: judgeRes.duration_ms,
  });

  return {
    answer: judgeRes.content,
    transcript,
    rounds: 1,
    converged: true,
    convergence_reason: 'single-pass-synthesized',
    cost: { usd: budget.total, tokens: totalTokens },
    duration_ms: totalDuration,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function resolveProvider(model: string, role: string): ProviderAdapter {
  const { provider } = providerRegistry.parseModel(model);
  const adapter = providerRegistry.get(provider);
  if (!adapter) {
    throw new Error(
      `No provider registered for "${provider}" (role: ${role}, model: ${model}). ` +
        `Register it via registerProvider() or use one of: ${listRegisteredProviders().join(', ')}`,
    );
  }
  return adapter;
}

function listRegisteredProviders(): string[] {
  // The registry doesn't expose a list method directly; the provider name is stored on each adapter.
  // Return what we can — limited but useful.
  const candidates = ['openrouter', 'anthropic', 'mock'];
  return candidates.filter((n) => providerRegistry.get(n));
}

async function callProvider(
  adapter: ProviderAdapter,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  cfg: RoleConfig,
  role: string,
  round: number,
  partialTranscript: Round[],
): Promise<{ content: string; tokens: Tokens; cost_usd: number; duration_ms: number }> {
  try {
    const res = await adapter.complete(messages, {
      model: providerRegistry.parseModel(cfg.model).model,
      providerOptions: cfg.providerOptions,
    });
    return {
      content: res.content,
      tokens: res.tokens,
      cost_usd: res.cost_usd,
      duration_ms: res.duration_ms,
    };
  } catch (err) {
    throw new ProviderError(`Provider "${adapter.name}" failed for role "${role}" at round ${round}: ${(err as Error).message}`, {
      provider: adapter.name,
      model: cfg.model,
      round,
      role,
      cause: err,
      partialTranscript: [...partialTranscript],
    });
  }
}
