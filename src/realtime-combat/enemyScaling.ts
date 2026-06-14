import type { Attributes, DifficultyRank } from './types.js';
import type { Rng } from './rng.js';

export const DIFFICULTY_LABELS: Record<DifficultyRank, string> = {
  D: 'D 級',
  C: 'C 級',
  B: 'B 級',
  A: 'A 級',
  S: 'S 級',
};

export const DIFFICULTY_RANKS: DifficultyRank[] = ['D', 'C', 'B', 'A', 'S'];

const RANK_ATTR_BUDGET: Record<DifficultyRank, number> = {
  D: 60,
  C: 90,
  B: 135,
  A: 200,
  S: 300,
};

export type EnemyArchetypeId =
  | 'goblin'
  | 'goblinKing'
  | 'werewolf'
  | 'eliteWerewolf'
  | 'werewolfLeader'
  | 'vampireBride'
  | 'vampireLord'
  | 'civilian'
  | 'vampireHunter';

interface EnemyArchetype {
  multiplier: number;
  weights: Attributes;
}

const ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetype> = {
  goblin: {
    multiplier: 0.75,
    weights: { str: 0.22, vit: 0.2, agi: 0.2, dex: 0.18, wil: 0.05, luk: 0.15 },
  },
  goblinKing: {
    multiplier: 1.9,
    weights: { str: 0.28, vit: 0.32, agi: 0.12, dex: 0.12, wil: 0.06, luk: 0.1 },
  },
  werewolf: {
    multiplier: 1,
    weights: { str: 0.26, vit: 0.22, agi: 0.26, dex: 0.14, wil: 0.04, luk: 0.08 },
  },
  eliteWerewolf: {
    multiplier: 1.55,
    weights: { str: 0.3, vit: 0.25, agi: 0.25, dex: 0.12, wil: 0.03, luk: 0.05 },
  },
  werewolfLeader: {
    multiplier: 2.35,
    weights: { str: 0.32, vit: 0.32, agi: 0.18, dex: 0.1, wil: 0.03, luk: 0.05 },
  },
  vampireBride: {
    multiplier: 1.25,
    weights: { str: 0.18, vit: 0.18, agi: 0.22, dex: 0.24, wil: 0.1, luk: 0.08 },
  },
  vampireLord: {
    multiplier: 3,
    weights: { str: 0.24, vit: 0.26, agi: 0.18, dex: 0.18, wil: 0.1, luk: 0.04 },
  },
  civilian: {
    multiplier: 0.25,
    weights: { str: 0.08, vit: 0.35, agi: 0.1, dex: 0.1, wil: 0.27, luk: 0.1 },
  },
  vampireHunter: {
    multiplier: 1,
    weights: { str: 0.24, vit: 0.2, agi: 0.2, dex: 0.24, wil: 0.06, luk: 0.06 },
  },
};

export function scaledEnemyAttrs(archetypeId: EnemyArchetypeId, rank: DifficultyRank, rng: Rng): Attributes {
  const archetype = ARCHETYPES[archetypeId];
  const variance = 0.9 + rng() * 0.2;
  const budget = RANK_ATTR_BUDGET[rank] * archetype.multiplier * variance;
  return {
    str: Math.max(1, Math.round(budget * archetype.weights.str)),
    vit: Math.max(1, Math.round(budget * archetype.weights.vit)),
    agi: Math.max(1, Math.round(budget * archetype.weights.agi)),
    dex: Math.max(1, Math.round(budget * archetype.weights.dex)),
    wil: Math.max(1, Math.round(budget * archetype.weights.wil)),
    luk: Math.max(1, Math.round(budget * archetype.weights.luk)),
  };
}
