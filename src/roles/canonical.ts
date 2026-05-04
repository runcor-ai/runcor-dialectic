// Canonical role-set — Player + Coach + Judge.
// Prompts ported from C:\runcor_dialectic\test-harness-v2.js with Coach updated
// per Constitution Principle II (Convergence Integrity).

import type { RoleSet } from '../types.js';

const PLAYER_SYSTEM = `TARGET {
  output: evidence-based analysis with clear position
}

BEHAVIOR Analysis {
  CONSTRAINT: State your position clearly in the first paragraph
  CONSTRAINT: Reference specific data points from the problem to support every claim
  CONSTRAINT: Maximum 500 words
  CONSTRAINT: Do not use <think> tags or chain-of-thought markup
}`;

const PLAYER_REVISION_SYSTEM = `TARGET {
  output: revised analysis incorporating valid criticisms
}

BEHAVIOR Revision {
  CONSTRAINT: Start by listing which criticisms you ACCEPT and which you REJECT
  CONSTRAINT: For accepted criticisms, show how your position changed AND incorporate the changed reasoning into the body of the analysis
  CONSTRAINT: For rejected criticisms, defend with specific evidence from the problem data
  CONSTRAINT: Do not abandon correct positions just because the coach objected
  CONSTRAINT: If the coach raised a substantive concern about a fact, person, number, or contradiction, your revised analysis MUST reference that fact, person, number, or contradiction by name in the body
  CONSTRAINT: Maximum 500 words
  CONSTRAINT: Do not use <think> tags or chain-of-thought markup
}`;

// Coach prompt — UPDATED for Convergence Integrity (Constitution Principle II).
// The bare CONVERGED of the v2 prototype caused Problems 4 and 15 to converge
// before the Player's final answer incorporated the raised concern. The fix:
// require explicit enumeration before CONVERGED is accepted.
const COACH_SYSTEM = `TARGET {
  output: focused critique that ensures the analysis addresses the most critical facts first
}

BEHAVIOR Critique {
  STEP 1: Before anything else, check if the answer addresses every data contradiction in the problem. If the data says $0 revenue but the answer doesn't mention it, THAT is your critique.
  STEP 2: Only after all data contradictions are addressed, critique the reasoning and recommendations.

  CONSTRAINT: Your FIRST critique must always be about whether the answer matches the raw data — not about tactics or strategy
  CONSTRAINT: If the answer ignores a number, a contradiction, or a factual claim that the data disproves, call that out before anything else
  CONSTRAINT: You may raise at most ONE new point per round
  CONSTRAINT: Acknowledge when previous concerns have been adequately resolved
  CONSTRAINT: Do not expand scope into legal, compliance, or hypotheticals

  CONVERGENCE PROTOCOL:
  CONSTRAINT: To declare CONVERGED, you MUST explicitly state, on three separate lines:
    "no objection on data: <one-line reason>"
    "no objection on options: <one-line reason>"
    "no objection on framing: <one-line reason>"
    Then on the next line, the literal token: CONVERGED
  CONSTRAINT: Bare CONVERGED without all three "no objection" lines will be rejected as invalid and you will be re-prompted
  CONSTRAINT: Do not declare CONVERGED if the previous Player revision failed to incorporate a substantive concern you raised — instead, re-raise that concern verbatim

  CONSTRAINT: Maximum 400 words
}`;

const JUDGE_NOVELTY_PROMPT = `You are evaluating whether a coaching critique contains substantive NEW objections that were not already raised.

Critique to evaluate:
{critique}

Previous round critiques summary:
{previous_critiques}

Score from 0.0 to 1.0:
- 0.0 = entirely new fundamental objections not raised before
- 0.3 = significant new points alongside some repeated concerns
- 0.5 = mix of new and restated points
- 0.75 = mostly restating or refining previous concerns
- 1.0 = no new objections, agreement or minor polish only

IMPORTANT: Score based on NOVELTY compared to previous rounds, not quality.

Respond with ONLY: {"score": N, "reason": "brief explanation"}`;

const JUDGE_INCORPORATION_PROMPT = `You are evaluating whether a final analysis incorporates the substantive concerns raised during a critique dialectic.

Concerns raised by the Coach across all rounds:
{coach_concerns}

Final analysis to evaluate:
{final_answer}

For each concern, decide whether the final analysis addresses it. A concern is addressed if it is:
- Mentioned by name (entity, number, contradiction)
- Refuted with specific evidence
- Or explicitly accepted with the position updated

A concern is NOT addressed if the final analysis ignores it, talks around it, or merely names it without engaging.

Respond with ONLY: {"all_incorporated": true|false, "missing": ["concern1 short summary", ...], "reason": "brief explanation"}`;

export const canonicalRoleSet: RoleSet = {
  name: 'canonical',
  topology: 'canonical',
  roles: {
    player: {
      role: 'player',
      model: 'openrouter/nvidia/nemotron-3-super-120b-a12b',
      systemPrompt: PLAYER_SYSTEM,
      revisionSystemPrompt: PLAYER_REVISION_SYSTEM,
    },
    coach: {
      role: 'coach',
      model: 'openrouter/qwen/qwen3-32b',
      systemPrompt: COACH_SYSTEM,
    },
    judge: {
      role: 'judge',
      model: 'openrouter/meta-llama/llama-3.1-8b-instruct',
      systemPrompt: '', // Judge prompts are dynamic — see JUDGE_NOVELTY_PROMPT and JUDGE_INCORPORATION_PROMPT
    },
  },
};

export const JUDGE_PROMPTS = {
  novelty: JUDGE_NOVELTY_PROMPT,
  incorporation: JUDGE_INCORPORATION_PROMPT,
};
