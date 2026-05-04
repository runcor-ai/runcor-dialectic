// Typed errors for runcor-dialectic.

import type { Round } from './types.js';

export class DialecticError extends Error {
  override readonly name: string = 'DialecticError';
  /** Partial transcript up to the point of failure. */
  readonly partialTranscript?: Round[];

  constructor(message: string, partialTranscript?: Round[]) {
    super(message);
    this.partialTranscript = partialTranscript;
  }
}

export class ProviderError extends DialecticError {
  override readonly name: string = 'ProviderError';
  readonly provider: string;
  readonly model: string;
  readonly round: number;
  readonly role: string;
  readonly cause?: unknown;

  constructor(
    message: string,
    info: {
      provider: string;
      model: string;
      round: number;
      role: string;
      cause?: unknown;
      partialTranscript?: Round[];
    },
  ) {
    super(message, info.partialTranscript);
    this.provider = info.provider;
    this.model = info.model;
    this.round = info.round;
    this.role = info.role;
    this.cause = info.cause;
  }
}

export class ConvergenceError extends DialecticError {
  override readonly name: string = 'ConvergenceError';
  readonly reason: string;

  constructor(message: string, reason: string, partialTranscript?: Round[]) {
    super(message, partialTranscript);
    this.reason = reason;
  }
}

export class BudgetExhaustedError extends DialecticError {
  override readonly name: string = 'BudgetExhaustedError';
  readonly cap_usd: number;
  readonly spent_usd: number;

  constructor(cap_usd: number, spent_usd: number, partialTranscript?: Round[]) {
    super(
      `Budget cap exceeded: spent $${spent_usd.toFixed(4)}, cap $${cap_usd.toFixed(4)}`,
      partialTranscript,
    );
    this.cap_usd = cap_usd;
    this.spent_usd = spent_usd;
  }
}

export class UnknownRoleSetError extends DialecticError {
  override readonly name: string = 'UnknownRoleSetError';
  readonly requested: string;
  readonly available: string[];

  constructor(requested: string, available: string[]) {
    super(
      `Unknown role-set "${requested}". Available: ${available.join(', ') || '(none)'}`,
    );
    this.requested = requested;
    this.available = available;
  }
}

export class EmptyResponseError extends ProviderError {
  override readonly name = 'EmptyResponseError';
}

export class ContextOverflowError extends ProviderError {
  override readonly name = 'ContextOverflowError';
}
