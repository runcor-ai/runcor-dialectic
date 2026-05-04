// Public API for runcor-dialectic.
// Auto-registers default providers (openrouter, anthropic, mock) and the canonical role-set.

import { providerRegistry } from './providers/index.js';
import { OpenRouterAdapter } from './providers/openrouter.js';
import { roleRegistry } from './roles/index.js';
import { canonicalRoleSet } from './roles/canonical.js';

// Auto-register defaults on first import.
providerRegistry.register(new OpenRouterAdapter());
// Anthropic adapter is registered lazily — the SDK is an optional peerDep.
// Consumers can call registerProvider(new AnthropicAdapter()) if they want it.
roleRegistry.registerRoleSet(canonicalRoleSet);

// Public exports.
export { dialectic } from './dialectic.js';
export { registerProvider, getProvider } from './providers/index.js';
export { registerRole, registerRoleSet } from './roles/index.js';
export { OpenRouterAdapter } from './providers/openrouter.js';
export { AnthropicAdapter } from './providers/anthropic.js';
export { MockAdapter } from './providers/mock.js';
export { canonicalRoleSet } from './roles/canonical.js';
export { computeCost, BudgetTracker, DEFAULT_PRICES } from './cost.js';
export {
  validateCoachConvergence,
  extractCoachConcerns,
  checkIncorporation,
  checkNovelty,
} from './convergence.js';

// Type exports.
export type {
  DialecticConfig,
  DialecticResult,
  Round,
  Tokens,
  CostBreakdown,
  ConvergenceReason,
  RoleConfig,
  RoleSet,
  ProviderAdapter,
  ProviderMessage,
  ProviderCallOptions,
  ProviderResult,
  ProviderRegistry,
  RoleRegistry,
} from './types.js';

export {
  DialecticError,
  ProviderError,
  ConvergenceError,
  BudgetExhaustedError,
  UnknownRoleSetError,
  EmptyResponseError,
  ContextOverflowError,
} from './errors.js';
