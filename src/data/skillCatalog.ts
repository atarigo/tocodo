import { LOADED_SKILLS } from './skillsLoader.js';
export type { SkillDefinition, SkillModifierDef, SkillOnHitEffect, SkillHealDef } from './skillsLoader.js';

export const SKILLS = LOADED_SKILLS;

export function skillById(id: string) {
  const skill = SKILLS[id];
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}
