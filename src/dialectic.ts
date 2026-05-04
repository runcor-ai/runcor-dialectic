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

  // Resolve providers
  const playerCfg = effectiveRoles['player'];
  const coachCfg = effectiveRoles['coach'];
  const judgeCfg = effectiveRoles['judge'];
  if (!playerCfg || !coachCfg || !judgeCfg) {
    throw new Error(`Role-set "${roleSetName}" missing required roles. Got: ${Object.keys(effectiveRoles).join(', ')}`);
  }

  const _prices = mergePrices(config.customPrices); // applied via cost.ts when adapter computes
  void _prices;
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
      { role: 'user' as const, content: `Problem:\n${config.problem}\n\nAnalysis to critique:\n${lastPlayerContent}` },
    ];
    let coachRes = await callProvider(coachProvider, coachMsg, coachCfg, 'coach', r, transcript);
    let validation = validateCoachConvergence(coachRes.content);

    // If Coach emitted bare CONVERGED, re-prompt once with stronger instruction
    if (validation.bare) {
      const followUp = [
        ...coachMsg,
        { role: 'assistant' as const, content: coachRes.content },
        { role: 'user' as const, content: `Your CONVERGED was rejected because you did not include the required enumeration. You MUST emit, on three separate lines:\n"no objection on data: <reason>"\n"no objection on options: <reason>"\n"no objection on framing: <reason>"\nThen on the next line: CONVERGED. If you cannot honestly emit those three lines, do not emit CONVERGED — instead provide a new critique.` },
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
        { role: 'user' as const, content:
          `Original problem:\n${config.problem}\n\nYour previous analysis:\n${lastPlayerContent}\n\nThe judge identified these missing concerns that your analysis did not address:\n${inc.missing.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nProvide a revised analysis that explicitly addresses each missing concern by name.` },
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
        { role: 'user' as const, content:
          `Original problem:\n${config.problem}\n\nYour previous analysis:\n${lastPlayerContent}\n\nThe judge identified these missing concerns that your analysis did not address:\n${inc.missing.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nProvide a revised analysis that explicitly addresses each missing concern by name.` },
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
      { role: 'user' as const, content:
        `Original problem:\n${config.problem}\n\nYour previous analysis:\n${lastPlayerContent}\n\nCritique received:\n${coachRes.content}\n\nProvide your revised analysis.` },
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
