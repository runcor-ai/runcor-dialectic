import { describe, it, expect } from 'vitest';
import { validateCoachConvergence, extractCoachConcerns } from '../../src/convergence.js';

describe('validateCoachConvergence', () => {
  it('rejects bare CONVERGED without enumeration', () => {
    const r = validateCoachConvergence('Looks good. CONVERGED');
    expect(r.valid).toBe(false);
    expect(r.bare).toBe(true);
    expect(r.missingEnumerations).toContain('no objection on data');
    expect(r.missingEnumerations).toContain('no objection on options');
    expect(r.missingEnumerations).toContain('no objection on framing');
  });

  it('accepts CONVERGED with all three enumeration phrases', () => {
    const r = validateCoachConvergence(
      'no objection on data: all numbers verified\n' +
      'no objection on options: all paths considered\n' +
      'no objection on framing: position is sound\n' +
      'CONVERGED'
    );
    expect(r.valid).toBe(true);
    expect(r.bare).toBe(false);
    expect(r.missingEnumerations).toEqual([]);
  });

  it('detects partial enumeration (only data and options)', () => {
    const r = validateCoachConvergence(
      'no objection on data: ok\nno objection on options: ok\nCONVERGED'
    );
    expect(r.valid).toBe(false);
    expect(r.bare).toBe(true);
    expect(r.missingEnumerations).toEqual(['no objection on framing']);
  });

  it('returns no-converged when CONVERGED is absent', () => {
    const r = validateCoachConvergence('Still have objections.');
    expect(r.valid).toBe(false);
    expect(r.bare).toBe(false);
    expect(r.missingEnumerations).toEqual([]);
  });

  it('is case-insensitive on the CONVERGED token', () => {
    const r = validateCoachConvergence(
      'no objection on data: ok\n' +
      'no objection on options: ok\n' +
      'no objection on framing: ok\n' +
      'converged'
    );
    expect(r.valid).toBe(true);
  });

  it('accepts enumeration in mixed case', () => {
    const r = validateCoachConvergence(
      'No Objection On Data: ok\n' +
      'NO OBJECTION ON OPTIONS: ok\n' +
      'no objection on framing: ok\n' +
      'CONVERGED'
    );
    expect(r.valid).toBe(true);
  });
});

describe('extractCoachConcerns', () => {
  it('extracts bullet-shaped concerns', () => {
    const critique =
      'The analysis has issues:\n' +
      '- The analysis ignores the $0 revenue contradiction\n' +
      '- It fails to address the missing Customer #2\n' +
      '- The strategy is sound otherwise';
    const concerns = extractCoachConcerns(critique);
    expect(concerns.length).toBeGreaterThanOrEqual(2);
    expect(concerns.some((c) => /\$0 revenue/.test(c))).toBe(true);
    expect(concerns.some((c) => /Customer #2/.test(c))).toBe(true);
  });

  it('skips enumeration lines', () => {
    const critique =
      'no objection on data: looks ok\n' +
      'no objection on options: looks ok\n' +
      'no objection on framing: looks ok\n' +
      'CONVERGED';
    const concerns = extractCoachConcerns(critique);
    expect(concerns.length).toBe(0);
  });

  it('extracts signal-bearing prose lines without bullets', () => {
    const critique = 'You should mention the missing customer. The analysis does not address Day 12 default.';
    const concerns = extractCoachConcerns(critique);
    expect(concerns.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for empty input', () => {
    expect(extractCoachConcerns('')).toEqual([]);
  });
});
