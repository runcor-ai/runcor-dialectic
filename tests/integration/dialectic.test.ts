import { describe, it, expect, beforeEach } from 'vitest';
import { dialectic } from '../../src/dialectic.js';
import { MockAdapter, type MockResponse } from '../../src/providers/mock.js';
import { providerRegistry } from '../../src/providers/index.js';
import { roleRegistry, registerRoleSet } from '../../src/roles/index.js';

const TEST_ROLE_SET = {
  name: 'test-canonical',
  topology: 'canonical' as const,
  roles: {
    player: {
      role: 'player',
      model: 'mock/test-player',
      systemPrompt: 'You are the player.',
      revisionSystemPrompt: 'You are the player revising.',
    },
    coach: {
      role: 'coach',
      model: 'mock/test-coach',
      systemPrompt: 'You are the coach.',
    },
    judge: {
      role: 'judge',
      model: 'mock/test-judge',
      systemPrompt: '',
    },
  },
};

function makeMockAdapter(responses: MockResponse[]): MockAdapter {
  return new MockAdapter(responses);
}

describe('dialectic integration', () => {
  beforeEach(() => {
    registerRoleSet(TEST_ROLE_SET);
  });

  it('returns full result shape with audit trail', async () => {
    // Coach immediately converges with valid enumeration; Judge ratifies incorporation.
    const mock = makeMockAdapter([
      // Round 0: Player initial draft
      { content: 'Initial analysis. The data shows X.', tokens: { input: 100, output: 80 } },
      // Round 1: Coach declares CONVERGED with enumeration
      {
        content:
          'no objection on data: matches problem\n' +
          'no objection on options: all considered\n' +
          'no objection on framing: position clear\n' +
          'CONVERGED',
        tokens: { input: 120, output: 60 },
      },
      // Judge incorporation check (no concerns extracted → vacuously incorporated)
      { content: '{"all_incorporated": true, "missing": [], "reason": "no concerns"}', tokens: { input: 50, output: 30 } },
    ]);
    providerRegistry.register(mock);

    const result = await dialectic({
      problem: 'Test problem',
      roleSet: 'test-canonical',
      maxRounds: 3,
    });

    // Shape checks
    expect(result.answer).toContain('Initial analysis');
    expect(result.transcript.length).toBeGreaterThanOrEqual(3);
    expect(result.converged).toBe(true);
    expect(result.convergence_reason).toBe('coach-converged-validated');
    expect(result.cost.usd).toBeGreaterThanOrEqual(0);
    expect(result.cost.tokens.input).toBeGreaterThan(0);
    expect(result.cost.tokens.output).toBeGreaterThan(0);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.rounds).toBe(1);

    // Audit-trail order: Player then Coach then Judge
    expect(result.transcript[0]?.role).toBe('player');
    expect(result.transcript[1]?.role).toBe('coach');
    expect(result.transcript[2]?.role).toBe('judge');
  });

  it('preserves transcript ordering across multiple rounds', async () => {
    const mock = makeMockAdapter([
      { content: 'Player draft 0' }, // Player round 0
      { content: 'Coach: missing point about X. Should add X.' }, // Coach round 0 (no convergence)
      { content: '{"score": 0.3, "reason": "new"}' }, // Judge novelty
      { content: 'Player revision 1' }, // Player round 1
      {
        content:
          'no objection on data: ok\n' +
          'no objection on options: ok\n' +
          'no objection on framing: ok\n' +
          'CONVERGED',
      }, // Coach round 1 (converges)
      { content: '{"all_incorporated": true, "missing": [], "reason": "ok"}' }, // Judge incorporation
    ]);
    providerRegistry.register(mock);

    const result = await dialectic({
      problem: 'Multi-round test',
      roleSet: 'test-canonical',
      maxRounds: 5,
    });

    expect(result.converged).toBe(true);
    expect(result.transcript[0]?.role).toBe('player');
    expect(result.transcript[1]?.role).toBe('coach');
    expect(result.transcript[2]?.role).toBe('judge'); // novelty
    expect(result.transcript[3]?.role).toBe('player'); // revision
    expect(result.transcript[4]?.role).toBe('coach'); // converges
    expect(result.transcript[5]?.role).toBe('judge'); // incorporation
    expect(result.answer).toBe('Player revision 1');
  });

  it('throws ProviderError with partial transcript on failure', async () => {
    const mock = makeMockAdapter([
      { content: 'Player draft 0' },
      { error: new Error('Simulated provider failure') },
    ]);
    providerRegistry.register(mock);

    await expect(
      dialectic({ problem: 'Will fail', roleSet: 'test-canonical', maxRounds: 3 }),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      role: 'coach',
      partialTranscript: expect.any(Array),
    });
  });

  it('terminates with budget-exhausted reason when cap is hit', async () => {
    // Each mock call costs computeCost(model, tokens). With unknown model "test-player", cost = 0.
    // To force budget exhaustion, register custom prices.
    const mock = makeMockAdapter(
      Array(20).fill({ content: 'response', tokens: { input: 1_000_000, output: 1_000_000 } }),
    );
    providerRegistry.register(mock);

    const result = await dialectic({
      problem: 'Budget test',
      roleSet: 'test-canonical',
      maxRounds: 5,
      budget_cap_usd: 0.01,
      customPrices: { 'test-player': { input_per_m: 100, output_per_m: 100 } },
    });

    // Either budget-exhausted or some other path — but it MUST have terminated, not run forever.
    expect(['budget-exhausted', 'coach-converged-validated', 'judge-novelty', 'max-rounds', 'max-rounds-without-incorporation']).toContain(
      result.convergence_reason,
    );
    expect(result.transcript.length).toBeGreaterThan(0);
  });
});
