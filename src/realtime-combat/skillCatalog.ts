import type { SkillId } from './types.js';

export interface SkillDefinition {
  id: SkillId;
  name: string;
  cooldown: number;
  damageMultiplier: number;
  minRange?: number;
  maxRange?: number;
  bleedChance?: number;
  bleedDuration?: number;
  bleedTickInterval?: number;
  bleedDamageRatio?: number;
  mpCost?: number;
  healPerSecondRatio?: number;
  healDuration?: number;
  healTickInterval?: number;
}

export const SKILLS: Record<SkillId, SkillDefinition> = {
  charge: {
    id: 'charge',
    name: '衝鋒',
    cooldown: 15,
    damageMultiplier: 0.3,
    minRange: 110,
    maxRange: 260,
  },
  bite: {
    id: 'bite',
    name: '撕咬',
    cooldown: 4,
    damageMultiplier: 0.8,
    bleedChance: 1,
    bleedDuration: 8,
    bleedTickInterval: 1,
    bleedDamageRatio: 0.2,
  },
  heal: {
    id: 'heal',
    name: '治療術',
    cooldown: 20,
    damageMultiplier: 0,
    mpCost: 2,
    healPerSecondRatio: 0.02,
    healDuration: 16,
    healTickInterval: 1,
  },
};

export function skillById(id: SkillId): SkillDefinition {
  return SKILLS[id];
}
