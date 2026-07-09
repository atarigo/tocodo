import type { Rank } from '../core/types.js';
import { parseYaml } from './yamlLoader.js';

export interface SkillModifierDef {
  target: string;
  op?: string;
  value: number;
}

export interface SkillOnHitEffect {
  effect: string;
  rank?: Rank;
  duration: number;
  amount?: number;
}

export interface SkillOnHitHeal {
  heal: {
    base: number;
    scaling?: Record<string, number>;
  };
}

export interface SkillHealDef {
  base: number;
  scaling?: Record<string, number>;
}

export type SkillActionType = 'strike' | 'cast' | 'instant';

export interface SkillDefinition {
  id: string;
  name: string;
  rank: Rank;
  tags: string[];
  action: SkillActionType;
  cooldown: number;
  mpCost?: number;
  castTime?: number;
  canCrit?: boolean;
  effectsIgnoreBreak?: boolean;
  price?: number;
  modifiers?: SkillModifierDef[];
  onHit?: (SkillOnHitEffect | SkillOnHitHeal)[];
  heal?: SkillHealDef;
}

interface YamlSkill {
  name: string;
  rank: Rank;
  tags: string[];
  action: SkillActionType;
  cooldown: number;
  mpCost?: number;
  castTime?: number;
  canCrit?: boolean;
  effectsIgnoreBreak?: boolean;
  price?: number;
  modifiers?: SkillModifierDef[];
  onHit?: (SkillOnHitEffect | SkillOnHitHeal)[];
  heal?: SkillHealDef;
}

function loadSkills(): Record<string, SkillDefinition> {
  const raw = parseYaml<Record<string, YamlSkill>>(skillsRaw);
  const result: Record<string, SkillDefinition> = {};

  for (const [id, entry] of Object.entries(raw)) {
    result[id] = { id, ...entry };
  }

  return result;
}

import skillsRaw from './content/skills.yaml?raw';

export const LOADED_SKILLS = loadSkills();
