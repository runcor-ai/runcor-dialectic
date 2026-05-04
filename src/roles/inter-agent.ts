// Inter-agent role-set: Player-A and Player-B alternate proposals; Judge ratifies.
// Used for cross-agent convergence on a shared workspace (collapsed Component #5).

import type { RoleSet } from '../types.js';

const PLAYER_A_SYSTEM = `TARGET {
  output: position on the shared problem from your assigned role's perspective
}

BEHAVIOR Position {
  CONSTRAINT: State your position clearly in the first paragraph
  CONSTRAINT: Reference specific data points from the shared workspace to support every claim
  CONSTRAINT: Acknowledge what the other agent (Player-B) has said, if applicable
  CONSTRAINT: If you disagree, name the specific point of disagreement and the evidence
  CONSTRAINT: Maximum 500 words
}`;

const PLAYER_B_SYSTEM = `TARGET {
  output: position on the shared problem from your assigned role's perspective
}

BEHAVIOR Position {
  CONSTRAINT: State your position clearly in the first paragraph
  CONSTRAINT: Reference specific data points from the shared workspace to support every claim
  CONSTRAINT: Acknowledge what the other agent (Player-A) has said
  CONSTRAINT: If you disagree, name the specific point of disagreement and the evidence
  CONSTRAINT: Do NOT just defer to Player-A — present your independent reading
  CONSTRAINT: Maximum 500 words
}`;

const JUDGE_INTER_AGENT_SYSTEM = `TARGET {
  output: synthesis of two agent positions into a shared resolution
}

BEHAVIOR Synthesis {
  CONSTRAINT: Identify the points of agreement between Player-A and Player-B
  CONSTRAINT: Identify the points of disagreement and which evidence supports which side
  CONSTRAINT: Where evidence supports one side, ratify that side; where it's ambiguous, escalate
  CONSTRAINT: The output IS the team's shared position — must be actionable
  CONSTRAINT: Maximum 400 words
}`;

export const interAgentRoleSet: RoleSet = {
  name: 'inter-agent',
  topology: 'inter-agent',
  roles: {
    'player-a': {
      role: 'player-a',
      model: 'openrouter/nvidia/nemotron-3-super-120b-a12b',
      systemPrompt: PLAYER_A_SYSTEM,
    },
    'player-b': {
      role: 'player-b',
      model: 'openrouter/qwen/qwen3-32b',
      systemPrompt: PLAYER_B_SYSTEM,
    },
    judge: {
      role: 'judge',
      model: 'openrouter/meta-llama/llama-3.1-8b-instruct',
      systemPrompt: JUDGE_INTER_AGENT_SYSTEM,
    },
  },
};
