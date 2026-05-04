import { describe, it, expect } from 'vitest';
import { computeCost, BudgetTracker, DEFAULT_PRICES, mergePrices } from '../../src/cost.js';

describe('computeCost', () => {
  it('computes cost for a known model from defaults', () => {
    const cost = computeCost('qwen/qwen3-32b', { input: 1_000_000, output: 1_000_000 });
    // 1M * $0.20/M (input) + 1M * $0.60/M (output) = $0.80
    expect(cost).toBeCloseTo(0.8, 5);
  });

  it('strips provider prefix when matching', () => {
    const cost = computeCost('openrouter/qwen/qwen3-32b', { input: 100_000, output: 200_000 });
    // 100k * $0.20/M + 200k * $0.60/M = $0.02 + $0.12 = $0.14
    expect(cost).toBeCloseTo(0.14, 5);
  });

  it('returns 0 for unknown model', () => {
    const cost = computeCost('unknown/model', { input: 1000, output: 1000 });
    expect(cost).toBe(0);
  });

  it('uses custom price table when provided', () => {
    const customPrices = { 'custom-model': { input_per_m: 1.0, output_per_m: 2.0 } };
    const cost = computeCost('custom-model', { input: 1_000_000, output: 1_000_000 }, customPrices);
    expect(cost).toBeCloseTo(3.0, 5);
  });

  it('matches expected cost for Nemotron 120B player call', () => {
    // From v2 prototype: nemotron at $0.30/M input, $0.60/M output
    const cost = computeCost('nvidia/nemotron-3-super-120b-a12b', { input: 500, output: 800 });
    expect(cost).toBeCloseTo(500 * 0.3 / 1e6 + 800 * 0.6 / 1e6, 6);
  });

  it('matches expected cost for Llama 3.1 8B judge call', () => {
    const cost = computeCost('meta-llama/llama-3.1-8b-instruct', { input: 200, output: 50 });
    expect(cost).toBeCloseTo(200 * 0.05 / 1e6 + 50 * 0.10 / 1e6, 6);
  });
});

describe('BudgetTracker', () => {
  it('returns false for wouldExceed when no cap is set', () => {
    const t = new BudgetTracker(undefined);
    expect(t.wouldExceed(1000)).toBe(false);
  });

  it('detects when adding would exceed cap', () => {
    const t = new BudgetTracker(0.10);
    t.add(0.05);
    expect(t.wouldExceed(0.06)).toBe(true);
    expect(t.wouldExceed(0.04)).toBe(false);
  });

  it('accumulates total correctly', () => {
    const t = new BudgetTracker(1.0);
    t.add(0.1);
    t.add(0.2);
    expect(t.total).toBeCloseTo(0.3, 6);
  });

  it('exposes the cap', () => {
    const t = new BudgetTracker(0.5);
    expect(t.cap).toBe(0.5);
  });
});

describe('mergePrices', () => {
  it('returns defaults when no custom provided', () => {
    expect(mergePrices(undefined)).toBe(DEFAULT_PRICES);
  });

  it('merges custom prices over defaults', () => {
    const merged = mergePrices({ 'nvidia/nemotron-3-super-120b-a12b': { input_per_m: 999, output_per_m: 999 } });
    expect(merged['nvidia/nemotron-3-super-120b-a12b']).toEqual({ input_per_m: 999, output_per_m: 999 });
    // Other defaults preserved
    expect(merged['qwen/qwen3-32b']).toEqual({ input_per_m: 0.2, output_per_m: 0.6 });
  });
});
