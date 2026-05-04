// MockAdapter — for tests. Returns canned responses from a queue.

import type { ProviderAdapter, ProviderCallOptions, ProviderMessage, ProviderResult } from '../types.js';
import { computeCost } from '../cost.js';

export interface MockResponse {
  content: string;
  tokens?: { input: number; output: number };
  /** Optional artificial delay in ms. */
  delay_ms?: number;
  /** Optional error to throw instead of returning. */
  error?: Error;
}

export class MockAdapter implements ProviderAdapter {
  readonly name = 'mock';
  private queue: MockResponse[];
  private callsMade = 0;

  constructor(responses: MockResponse[]) {
    this.queue = [...responses];
  }

  async complete(_messages: ProviderMessage[], options: ProviderCallOptions): Promise<ProviderResult> {
    const next = this.queue.shift();
    if (!next) {
      throw new Error(`MockAdapter: no more queued responses (${this.callsMade} calls made)`);
    }
    this.callsMade++;
    if (next.delay_ms) {
      await new Promise((r) => setTimeout(r, next.delay_ms));
    }
    if (next.error) {
      throw next.error;
    }
    const tokens = next.tokens ?? { input: 100, output: 200 };
    return {
      content: next.content,
      tokens,
      cost_usd: computeCost(options.model, tokens),
      duration_ms: next.delay_ms ?? 1,
    };
  }

  /** How many calls have been made (for test assertions). */
  get calls(): number {
    return this.callsMade;
  }

  /** Remaining queued responses. */
  get remaining(): number {
    return this.queue.length;
  }
}
