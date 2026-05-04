// Cost computation — Constitution Principle IV (Cost Transparency).
// All prices in USD per 1 million tokens. Computed at call time.
// Sourced from OpenRouter pricing page; refresh policy: every release.

import type { Tokens } from './types.js';

export interface ModelPrice {
  input_per_m: number;
  output_per_m: number;
}

/**
 * Default per-model prices. Update on release per OpenRouter / Anthropic pricing.
 * Last refreshed: 2026-05-03.
 */
export const DEFAULT_PRICES: Record<string, ModelPrice> = {
  // Player default
  'nvidia/nemotron-3-super-120b-a12b': { input_per_m: 0.3, output_per_m: 0.6 },
  // Coach default
  'qwen/qwen3-32b': { input_per_m: 0.2, output_per_m: 0.6 },
  // Judge default
  'meta-llama/llama-3.1-8b-instruct': { input_per_m: 0.05, output_per_m: 0.1 },
  // Baseline (for benchmark)
  'claude-sonnet-4-20250514': { input_per_m: 3.0, output_per_m: 15.0 },
};

/**
 * Compute cost in USD for a given model and token usage.
 * Returns 0 (with no error) for unknown models — use a custom price table to override.
 */
export function computeCost(
  model: string,
  tokens: Tokens,
  prices: Record<string, ModelPrice> = DEFAULT_PRICES,
): number {
  // Try exact match, then strip provider prefix (e.g. "openrouter/foo/bar" → "foo/bar").
  let price = prices[model];
  if (!price) {
    const slashIdx = model.indexOf('/');
    if (slashIdx >= 0) {
      const stripped = model.slice(slashIdx + 1);
      price = prices[stripped];
    }
  }
  if (!price) return 0;
  return (
    (tokens.input * price.input_per_m) / 1_000_000 +
    (tokens.output * price.output_per_m) / 1_000_000
  );
}

/**
 * Tracks cumulative cost across a dialectic run. Supports a hard budget cap.
 */
export class BudgetTracker {
  private spent = 0;

  constructor(private readonly cap_usd: number | undefined) {}

  /** Add an amount to the running total. Returns the new total. */
  add(amount: number): number {
    this.spent += amount;
    return this.spent;
  }

  /** Check whether adding `amount` would exceed the cap. False if no cap configured. */
  wouldExceed(amount: number): boolean {
    if (this.cap_usd === undefined) return false;
    return this.spent + amount > this.cap_usd;
  }

  /** Total spent so far. */
  get total(): number {
    return this.spent;
  }

  /** Cap or undefined if unset. */
  get cap(): number | undefined {
    return this.cap_usd;
  }
}

/**
 * Merge a custom price table into the defaults (custom wins on collision).
 */
export function mergePrices(
  custom: Record<string, ModelPrice> | undefined,
): Record<string, ModelPrice> {
  if (!custom) return DEFAULT_PRICES;
  return { ...DEFAULT_PRICES, ...custom };
}
