export type Tag = string;

export interface WeaponAttrRules {
  strApplies: boolean;
  agiApplies: boolean;
  dexAmp: boolean;
  canCrit: boolean;
}

const ALL_ON: WeaponAttrRules = { strApplies: true, agiApplies: true, dexAmp: true, canCrit: true };
const ALL_OFF: WeaponAttrRules = { strApplies: false, agiApplies: false, dexAmp: false, canCrit: false };

const TAG_RULES: { match: (tags: Tag[]) => boolean; rules: WeaponAttrRules }[] = [
  { match: (tags) => tags.includes('ranged') && tags.includes('gun'), rules: ALL_OFF },
  { match: (tags) => tags.includes('melee'), rules: ALL_ON },
  { match: (tags) => tags.includes('ranged') && tags.includes('bow'), rules: ALL_ON },
  { match: (tags) => tags.includes('staff'), rules: ALL_ON },
];

export function weaponAttrRules(weaponTags: Tag[]): WeaponAttrRules {
  for (const rule of TAG_RULES) {
    if (rule.match(weaponTags)) return rule.rules;
  }
  return ALL_OFF;
}

export function isCompatible(
  skillRequiredTags: Tag[],
  weaponTags: Tag[],
): boolean {
  if (skillRequiredTags.length === 0) return true;
  const weaponSet = new Set(weaponTags);
  return skillRequiredTags.every((tag) => weaponSet.has(tag));
}
