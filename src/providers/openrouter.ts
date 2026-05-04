// OpenRouterAdapter — HTTP fetch with 429 retry, parses tokens, computes cost.

import type {
  ProviderAdapter,
  ProviderCallOptions,
  ProviderMessage,
  ProviderResult,
} from '../types.js';
import { computeCost } from '../cost.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const RETRY_BACKOFF_SECONDS = [15, 30, 45]; // per spec FR-005 acceptance scenario 2

export interface OpenRouterAdapterOptions {
  /** API key. Defaults to process.env.OPENROUTER_API_KEY. */
  apiKey?: string;
  /** Override the URL (for testing). */
  url?: string;
  /** Override fetch (for testing). */
  fetchImpl?: typeof fetch;
  /** Custom retry backoff seconds. */
  retryBackoffSeconds?: number[];
}

export class OpenRouterAdapter implements ProviderAdapter {
  readonly name = 'openrouter';
  private readonly apiKey: string;
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly backoff: number[];

  constructor(options: OpenRouterAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? process.env['OPENROUTER_API_KEY'] ?? '';
    this.url = options.url ?? OPENROUTER_URL;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.backoff = options.retryBackoffSeconds ?? RETRY_BACKOFF_SECONDS;
  }

  async complete(
    messages: ProviderMessage[],
    options: ProviderCallOptions,
  ): Promise<ProviderResult> {
    if (!this.apiKey) {
      throw new Error('OpenRouterAdapter: OPENROUTER_API_KEY not set');
    }
    const body = JSON.stringify({
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      ...options.providerOptions,
    });
    const maxAttempts = this.backoff.length + 1;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const start = Date.now();
      try {
        const res = await this.fetchImpl(this.url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
        });
        if (res.status === 429 && attempt < this.backoff.length) {
          const wait = this.backoff[attempt];
          if (wait !== undefined) {
            await new Promise((r) => setTimeout(r, wait * 1000));
          }
          continue;
        }
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenRouter ${options.model} error ${res.status}: ${errText}`);
        }
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
          if (attempt < maxAttempts - 1) {
            await new Promise((r) => setTimeout(r, 10_000));
            continue;
          }
          throw new Error(`OpenRouter ${options.model} returned empty response`);
        }
        const tokens = {
          input: data.usage?.prompt_tokens ?? 0,
          output: data.usage?.completion_tokens ?? 0,
        };
        return {
          content,
          tokens,
          cost_usd: computeCost(options.model, tokens),
          duration_ms: Date.now() - start,
        };
      } catch (err) {
        lastError = err as Error;
        if (attempt >= maxAttempts - 1) throw lastError;
      }
    }
    throw lastError ?? new Error('OpenRouterAdapter: unknown failure');
  }
}
