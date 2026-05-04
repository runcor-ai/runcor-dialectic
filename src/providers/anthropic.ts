// AnthropicAdapter — uses @anthropic-ai/sdk (optional peerDep). Used by benchmark baseline.

import type {
  ProviderAdapter,
  ProviderCallOptions,
  ProviderMessage,
  ProviderResult,
} from '../types.js';
import { computeCost } from '../cost.js';

export interface AnthropicAdapterOptions {
  apiKey?: string;
}

interface AnthropicSdkLike {
  messages: {
    create(params: {
      model: string;
      max_tokens: number;
      temperature?: number;
      system?: string;
      messages: Array<{ role: string; content: string }>;
    }): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = 'anthropic';
  private readonly clientPromise: Promise<AnthropicSdkLike>;

  constructor(options: AnthropicAdapterOptions = {}) {
    this.clientPromise = this.loadClient(options);
  }

  private async loadClient(options: AnthropicAdapterOptions): Promise<AnthropicSdkLike> {
    let mod: { default?: new (cfg?: { apiKey?: string }) => AnthropicSdkLike };
    try {
      // Dynamic import — keeps the SDK as an optional peerDep.
      mod = (await import('@anthropic-ai/sdk')) as typeof mod;
    } catch (err) {
      throw new Error(
        'AnthropicAdapter requires @anthropic-ai/sdk to be installed. ' +
          'Run: npm install @anthropic-ai/sdk',
      );
    }
    const Anthropic = mod.default;
    if (!Anthropic) {
      throw new Error('AnthropicAdapter: @anthropic-ai/sdk did not export a default class');
    }
    const apiKey = options.apiKey ?? process.env['ANTHROPIC_API_KEY'];
    return new Anthropic(apiKey ? { apiKey } : undefined);
  }

  async complete(
    messages: ProviderMessage[],
    options: ProviderCallOptions,
  ): Promise<ProviderResult> {
    const client = await this.clientPromise;
    const start = Date.now();

    // Split out system prompt(s) — Anthropic API takes system separately.
    const systems = messages.filter((m) => m.role === 'system').map((m) => m.content);
    const nonSystem = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const params: Parameters<AnthropicSdkLike['messages']['create']>[0] = {
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      messages: nonSystem,
    };
    if (systems.length > 0) {
      params.system = systems.join('\n\n');
    }

    const resp = await client.messages.create(params);
    const text = resp.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
    const tokens = { input: resp.usage.input_tokens, output: resp.usage.output_tokens };
    return {
      content: text,
      tokens,
      cost_usd: computeCost(options.model, tokens),
      duration_ms: Date.now() - start,
    };
  }
}
