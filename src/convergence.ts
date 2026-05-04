// Convergence-integrity logic — Constitution Principle II (NON-NEGOTIABLE).
// Two mechanisms:
// (a) Coach must explicitly enumerate "no objection on data/options/framing" before CONVERGED is accepted
// (b) Judge has incorporation-veto: if final Player answer fails to incorporate substantive Coach concerns,
//     convergence is vetoed and the loop continues.

import type { ProviderAdapter, ProviderResult } from './types.js';
import { JUDGE_PROMPTS } from './roles/canonical.js';

export interface CoachConvergenceResult {
  /** True if Coach validly emitted CONVERGED (with required enumeration). */
  valid: boolean;
  /** True if Coach emitted bare CONVERGED without enumeration. */
  bare: boolean;
  /** Which enumeration phrases are missing (if bare). */
  missingEnumerations: string[];
}

const REQUIRED_ENUMERATIONS = [
  'no objection on data',
  'no objection on options',
  'no objection on framing',
];

/**
 * Validate whether a Coach critique contains a valid CONVERGED token.
 * Returns:
 *   { valid: true,  bare: false, missingEnumerations: [] } if CONVERGED + all 3 enumerations present
 *   { valid: false, bare: true,  missingEnumerations: [...] } if CONVERGED present but enumerations missing
 *   { valid: false, bare: false, missingEnumerations: [] } if no CONVERGED at all
 */
export function validateCoachConvergence(critique: string): CoachConvergenceResult {
  const upper = critique.toUpperCase();
  const hasConverged = /\bCONVERGED\b/.test(upper);
  if (!hasConverged) {
    return { valid: false, bare: false, missingEnumerations: [] };
  }
  const lower = critique.toLowerCase();
  const missing = REQUIRED_ENUMERATIONS.filter((phrase) => !lower.includes(phrase));
  if (missing.length === 0) {
    return { valid: true, bare: false, missingEnumerations: [] };
  }
  return { valid: false, bare: true, missingEnumerations: missing };
}

/**
 * Extract substantive Coach concerns from a critique. Heuristic:
 * - Lines starting with "- ", "* ", numbered bullets, or sentences containing "should",
 *   "missing", "ignored", "fails to", "doesn't address" are candidate concerns.
 * - Filters out CONVERGENCE PROTOCOL boilerplate.
 */
export function extractCoachConcerns(critique: string): string[] {
  const lines = critique.split('\n');
  const concerns: string[] = [];
  const concernSignals = /\b(should|missing|ignored|fails? to|doesn'?t address|did not|hasn'?t addressed|where is|why no|what about|not covered)\b/i;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^no objection on /i.test(line)) continue;
    if (/^converged$/i.test(line)) continue;
    if (line.length < 10) continue;
    // Bullet or numbered or signal-bearing
    if (/^[-*•]\s/.test(line) || /^\d+[.)]\s/.test(line) || concernSignals.test(line)) {
      concerns.push(line.replace(/^[-*•\d.)\s]+/, '').trim());
    }
  }
  return concerns.filter(Boolean);
}

export interface IncorporationCheckResult {
  incorporated: boolean;
  missing: string[];
  reason: string;
  judgeCost_usd: number;
  judgeTokens: { input: number; output: number };
  judgeDuration_ms: number;
}

/**
 * Use the Judge to check whether the final Player answer incorporates the Coach's concerns.
 * If not, returns incorporated=false with the missing concerns — the dialectic should NOT converge.
 */
export async function checkIncorporation(
  coachConcerns: string[],
  finalAnswer: string,
  judge: ProviderAdapter,
  judgeModel: string,
): Promise<IncorporationCheckResult> {
  if (coachConcerns.length === 0) {
    // No concerns to incorporate → vacuously incorporated.
    return {
      incorporated: true,
      missing: [],
      reason: 'No Coach concerns to incorporate',
      judgeCost_usd: 0,
      judgeTokens: { input: 0, output: 0 },
      judgeDuration_ms: 0,
    };
  }
  const prompt = JUDGE_PROMPTS.incorporation
    .replace('{coach_concerns}', coachConcerns.map((c, i) => `${i + 1}. ${c}`).join('\n'))
    .replace('{final_answer}', finalAnswer);
  const res: ProviderResult = await judge.complete(
    [{ role: 'user', content: prompt }],
    { model: judgeModel, maxTokens: 512, temperature: 0.1 },
  );
  // Parse JSON from response
  let parsed: { all_incorporated: boolean; missing: string[]; reason: string };
  try {
    const match = res.content.match(/\{[\s\S]*?"all_incorporated"[\s\S]*?\}/);
    if (!match) throw new Error('no JSON found');
    parsed = JSON.parse(match[0]);
  } catch {
    parsed = { all_incorporated: true, missing: [], reason: 'Failed to parse judge response — defaulting to converged' };
  }
  return {
    incorporated: parsed.all_incorporated,
    missing: parsed.missing ?? [],
    reason: parsed.reason ?? '',
    judgeCost_usd: res.cost_usd,
    judgeTokens: res.tokens,
    judgeDuration_ms: res.duration_ms,
  };
}

export interface NoveltyCheckResult {
  score: number;
  reason: string;
  judgeCost_usd: number;
  judgeTokens: { input: number; output: number };
  judgeDuration_ms: number;
}

/**
 * Use the Judge to score how novel a Coach critique is vs. previous rounds.
 * High score (>= threshold) signals convergence by exhaustion.
 */
export async function checkNovelty(
  critique: string,
  previousCritiques: string[],
  judge: ProviderAdapter,
  judgeModel: string,
): Promise<NoveltyCheckResult> {
  const prev = previousCritiques.length === 0
    ? 'None — this is the first round.'
    : previousCritiques.map((c, i) => `Round ${i + 1}: ${c.slice(0, 200)}`).join('\n');
  const prompt = JUDGE_PROMPTS.novelty
    .replace('{critique}', critique)
    .replace('{previous_critiques}', prev);
  const res: ProviderResult = await judge.complete(
    [{ role: 'user', content: prompt }],
    { model: judgeModel, maxTokens: 256, temperature: 0.1 },
  );
  let parsed: { score: number; reason: string } = { score: 0.5, reason: 'Failed to parse judge response' };
  try {
    const match = res.content.match(/\{[\s\S]*?"score"[\s\S]*?\}/);
    if (match) {
      const obj = JSON.parse(match[0]) as { score?: number; reason?: string };
      parsed = {
        score: typeof obj.score === 'number' ? obj.score : 0.5,
        reason: obj.reason ?? '',
      };
    }
  } catch {
    /* fall through to default */
  }
  return {
    score: parsed.score,
    reason: parsed.reason,
    judgeCost_usd: res.cost_usd,
    judgeTokens: res.tokens,
    judgeDuration_ms: res.duration_ms,
  };
}
