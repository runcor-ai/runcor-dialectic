// Public types for runcor-dialectic.
// All exported via src/index.ts.

// ── Token + cost primitives ─────────────────────────────────────────────────

export interface Tokens {
  input: number;
  output: number;
}

export interface CostBreakdown {
  usd: number;
  tokens: Tokens;
}

// ── Provider adapter contract ───────────────────────────────────────────────

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderCallOptions {
  /** Model identifier — provider-prefixed (e.g. "openrouter/qwen/qwen3-32b") or bare. */
  model: string;
  maxTokens?: number;
  temperature?: number;
  /** Provider-specific overrides. */
  providerOptions?: Record<string, unknown>;
}

export interface ProviderResult {
  content: string;
  tokens: Tokens;
  /** Cost in USD computed by the adapter using cost.ts. */
  cost_usd: number;
  duration_ms: number;
}

export interface ProviderAdapter {
  /** Provider name (registry key). */
  name: string;
  /** Make a model call. */
  complete(messages: ProviderMessage[], options: ProviderCallOptions): Promise<ProviderResult>;
}

// ── Role configuration ──────────────────────────────────────────────────────

export type CanonicalRoleName = 'player' | 'coach' | 'judge';

export interface RoleConfig {
  /** Role name — canonical or custom. */
  role: string;
  /** Model identifier with provider prefix, e.g. "openrouter/nvidia/nemotron-3-super-120b-a12b". */
  model: string;
  /** System prompt for this role. */
  systemPrompt: string;
  /** Optional revision system prompt (for Player on rounds > 0). */
  revisionSystemPrompt?: string;
  /** Provider-specific options merged into every call. */
  providerOptions?: Record<string, unknown>;
}

export interface RoleSet {
  /** Role-set identifier (e.g. "canonical", "inter-agent", "multi-critic"). */
  name: string;
  /** Roles in this set, indexed by role name. */
  roles: Record<string, RoleConfig>;
  /** How turns are routed. */
  topology: 'canonical' | 'inter-agent' | 'multi-critic' | 'custom';
}

// ── Audit-trail primitives ──────────────────────────────────────────────────

export interface Round {
  /** Sequential round index (Player-0, Coach-0, Player-1, ...). */
  index: number;
  /** Round number from the dialectic's perspective (0 = initial draft, 1 = first revision, ...). */
  round: number;
  /** Role that produced this entry. */
  role: string;
  /** Model that produced this entry. */
  model: string;
  /** Full content (no truncation). */
  content: string;
  tokens: Tokens;
  cost_usd: number;
  duration_ms: number;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

// ── Convergence ─────────────────────────────────────────────────────────────

export type ConvergenceReason =
  | 'coach-converged-validated'
  | 'coach-bare-converged-warning'
  | 'judge-novelty'
  | 'judge-incorporation-vetoed'
  | 'max-rounds-without-incorporation'
  | 'max-rounds'
  | 'budget-exhausted'
  | 'single-pass-synthesized'; // multi-critic and inter-agent topologies — no convergence loop

// ── Dialectic input/output ──────────────────────────────────────────────────

export interface DialecticConfig {
  /** The problem the dialectic should reason about. */
  problem: string;
  /** Role-set to use. Defaults to "canonical". */
  roleSet?: string;
  /** Maximum coach/revision rounds. Defaults to 5. */
  maxRounds?: number;
  /** Hard budget cap in USD. Terminates run with `convergence_reason: 'budget-exhausted'` if exceeded. */
  budget_cap_usd?: number;
  /** Judge novelty threshold for convergence. Defaults to 0.75. */
  convergenceThreshold?: number;
  /** Per-model price overrides (USD per 1M tokens). Merged into defaults. */
  customPrices?: Record<string, { input_per_m: number; output_per_m: number }>;
  /** Per-role overrides. If a role is supplied here, it overrides the role-set entry. */
  roles?: Partial<Record<string, RoleConfig>>;
  /** Engine-pluggable model interface. When provided, every Player/Coach/Judge
   *  call routes through this instead of the internal ProviderRegistry. Use
   *  this when running inside a runcor engine flow: pass `ctx.model`. The
   *  RoleConfig.model field becomes the model identifier passed to the engine;
   *  any "openrouter/" prefix is stripped before forwarding. When omitted, the
   *  legacy ProviderAdapter path runs (standalone library use). */
  model?: DialecticModelInterface;
}

export interface DialecticResult {
  /** The final Player answer. */
  answer: string;
  /** Complete audit trail — every Player draft, every Coach critique, every Judge call. */
  transcript: Round[];
  /** Number of Coach rounds that ran. */
  rounds: number;
  /** Whether convergence was reached (vs. max-rounds / budget-exhausted). */
  converged: boolean;
  convergence_reason: ConvergenceReason;
  /** Total cost across all calls (Player + Coach + Judge). */
  cost: CostBreakdown;
  /** Total wall-clock time across all calls. */
  duration_ms: number;
}

// ── Registries (returned by getRegistry, etc.) ──────────────────────────────

export interface ProviderRegistry {
  register(adapter: ProviderAdapter): void;
  get(name: string): ProviderAdapter | undefined;
  /** Returns provider name and bare model id from a full model string like "openrouter/qwen/qwen3-32b". */
  parseModel(model: string): { provider: string; model: string };
}

export interface RoleRegistry {
  registerRole(name: string, config: Omit<RoleConfig, 'role'>): void;
  getRole(name: string): RoleConfig | undefined;
  registerRoleSet(set: RoleSet): void;
  getRoleSet(name: string): RoleSet | undefined;
  listRoleSets(): string[];
}

// ── ModelInterface (engine-pluggable model call surface) ────────────────────
// Shape-compatible with the runcor engine's ModelInterface (ctx.model). When a
// DialecticConfig is passed with `model: <ModelInterface>`, every Player/Coach/
// Judge call routes through it INSTEAD of the internal ProviderRegistry. This
// is how runcor-lattice wires the dialectic into the engine — engine handles
// routing, fallback, cost ledger, telemetry, policy. The legacy ProviderAdapter
// path remains for standalone library use where no engine is available.

export interface DialecticModelRequest {
  /** Model identifier (bare, e.g. "nvidia/nemotron-3-super-120b-a12b" — no provider prefix). */
  model: string;
  /** Conversation history. */
  messages: ProviderMessage[];
  /** Optional max response tokens. */
  maxTokens?: number;
  /** Optional temperature. */
  temperature?: number;
  /** Pin to a specific provider by name (e.g. "openrouter", "anthropic"). */
  provider?: string;
  /** Optional system prompt separate from messages. */
  systemPrompt?: string;
}

export interface DialecticModelResponse {
  /** The completion text. */
  text: string;
  /** Token usage from the underlying provider. */
  usage: { promptTokens: number; completionTokens: number };
  /** Model that produced the response (may differ from request.model when router picked a fallback). */
  model: string;
  /** Provider that handled the request. */
  provider: string;
}

export interface DialecticModelInterface {
  complete(request: DialecticModelRequest): Promise<DialecticModelResponse>;
}
