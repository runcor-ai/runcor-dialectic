// Provider registry — Constitution Principle V (Provider Agnosticism).

import type { ProviderAdapter, ProviderRegistry } from '../types.js';

class Registry implements ProviderRegistry {
  private adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: string): ProviderAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Parse a model string like "openrouter/qwen/qwen3-32b" into provider + model.
   * If no provider prefix is present, assumes "openrouter".
   */
  parseModel(model: string): { provider: string; model: string } {
    const slashIdx = model.indexOf('/');
    if (slashIdx === -1) {
      return { provider: 'openrouter', model };
    }
    const candidate = model.slice(0, slashIdx);
    // If the prefix is a registered provider, treat as provider/model.
    if (this.adapters.has(candidate)) {
      return { provider: candidate, model: model.slice(slashIdx + 1) };
    }
    // Otherwise default to openrouter and pass the full string through.
    return { provider: 'openrouter', model };
  }
}

export const providerRegistry: ProviderRegistry = new Registry();

export function registerProvider(adapter: ProviderAdapter): void {
  providerRegistry.register(adapter);
}

export function getProvider(name: string): ProviderAdapter | undefined {
  return providerRegistry.get(name);
}
