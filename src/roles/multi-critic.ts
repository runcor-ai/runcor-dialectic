// Multi-critic role-set: Player drafts; multiple specialized critics each critique;
// Judge ratifies. Useful for problems where a single Coach lens is too narrow.

import type { RoleSet } from '../types.js';

const PLAYER_SYSTEM = `TARGET {
  output: evidence-based analysis with clear position
}

BEHAVIOR Analysis {
  CONSTRAINT: State your position clearly in the first paragraph
  CONSTRAINT: Reference specific data points to support every claim
  CONSTRAINT: Maximum 500 words
}`;

const DEVIL_ADVOCATE_SYSTEM = `TARGET {
  output: opposing case to the Player's position
}

BEHAVIOR DevilsAdvocate {
  CONSTRAINT: Find the strongest argument AGAINST the Player's position
  CONSTRAINT: Reference specific data that undermines the Player's claims
  CONSTRAINT: Do NOT critique the data — propose an alternative interpretation
  CONSTRAINT: Maximum 300 words
}`;

const LONG_TERM_SYSTEM = `TARGET {
  output: critique focused on multi-cycle / long-horizon implications
}

BEHAVIOR LongTermLens {
  CONSTRAINT: Evaluate the Player's recommendation across a longer horizon (3+ cycles, weeks, or months)
  CONSTRAINT: Identify second-order effects the Player ignored
  CONSTRAINT: Flag commitments that lock in a path that may not work later
  CONSTRAINT: Maximum 300 words
}`;

const COST_CONSCIOUS_SYSTEM = `TARGET {
  output: critique focused on resource cost and efficiency
}

BEHAVIOR CostLens {
  CONSTRAINT: Evaluate the Player's recommendation against budget, time, and opportunity cost
  CONSTRAINT: Identify cheaper alternatives that achieve 80%+ of the same outcome
  CONSTRAINT: Quantify cost in dollars, hours, or cycles where possible
  CONSTRAINT: Maximum 300 words
}`;

const MULTI_CRITIC_JUDGE_SYSTEM = `TARGET {
  output: synthesis ratifying or amending the Player's position based on three critics
}

BEHAVIOR Synthesis {
  CONSTRAINT: Read the Player's position, then read all three critics' critiques
  CONSTRAINT: For each critic's substantive concern, decide whether the Player should incorporate it
  CONSTRAINT: Output a final amended position with explicit incorporation/rejection of each critic
  CONSTRAINT: Maximum 500 words
}`;

export const multiCriticRoleSet: RoleSet = {
  name: 'multi-critic',
  topology: 'multi-critic',
  roles: {
    player: {
      role: 'player',
      model: 'openrouter/nvidia/nemotron-3-super-120b-a12b',
      systemPrompt: PLAYER_SYSTEM,
    },
    'devil-advocate': {
      role: 'devil-advocate',
      model: 'openrouter/qwen/qwen3-32b',
      systemPrompt: DEVIL_ADVOCATE_SYSTEM,
    },
    'long-term': {
      role: 'long-term',
      model: 'openrouter/qwen/qwen3-32b',
      systemPrompt: LONG_TERM_SYSTEM,
    },
    'cost-conscious': {
      role: 'cost-conscious',
      model: 'openrouter/qwen/qwen3-32b',
      systemPrompt: COST_CONSCIOUS_SYSTEM,
    },
    judge: {
      role: 'judge',
      model: 'openrouter/meta-llama/llama-3.1-8b-instruct',
      systemPrompt: MULTI_CRITIC_JUDGE_SYSTEM,
    },
  },
};
