import type { Rank, SkillId, StatusId } from '../core/types.js';

export type SkillTargetType = 'self' | 'enemy';

export type SkillEffect =
  | {
      kind: 'moveToTarget';
      stopDistanceBonus: number;
    }
  | {
      kind: 'damage';
      multiplier: number;
    }
  | {
      kind: 'applyStatus';
      statusId: StatusId;
      chance: number;
      duration: number;
      amount:
        | {
            kind: 'damageRatio';
            ratio: number;
          }
        | {
            kind: 'targetMaxHpRatio';
            ratio: number;
          };
    };

export interface SkillDefinition {
  id: SkillId;
  name: string;
  rank: Rank;
  price?: number;
  cooldown: number;
  targetType: SkillTargetType;
  effects: SkillEffect[];
  requiresMeleeRange?: boolean;
  requiresLineOfSight?: boolean;
  minRange?: number;
  maxRange?: number;
  mpCost?: number;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  charge: {
    id: 'charge',
    name: '衝鋒',
    rank: 'D',
    cooldown: 15,
    targetType: 'enemy',
    minRange: 110,
    maxRange: 260,
    requiresLineOfSight: true,
    effects: [
      { kind: 'moveToTarget', stopDistanceBonus: 4 },
      { kind: 'damage', multiplier: 0.3 },
    ],
  },
  bite: {
    id: 'bite',
    name: '撕咬',
    rank: 'D',
    cooldown: 4,
    targetType: 'enemy',
    requiresMeleeRange: true,
    requiresLineOfSight: true,
    effects: [
      { kind: 'damage', multiplier: 0.8 },
      {
        kind: 'applyStatus',
        statusId: 'bleed',
        chance: 1,
        duration: 8,
        amount: { kind: 'damageRatio', ratio: 0.2 },
      },
    ],
  },
  heal: {
    id: 'heal',
    name: '治療術',
    rank: 'D',
    cooldown: 20,
    targetType: 'self',
    mpCost: 2,
    effects: [
      {
        kind: 'applyStatus',
        statusId: 'healing',
        chance: 1,
        duration: 16,
        amount: { kind: 'targetMaxHpRatio', ratio: 0.02 },
      },
    ],
  },
};

export function skillById(id: SkillId): SkillDefinition {
  return SKILLS[id];
}
