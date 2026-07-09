import type { Modifier } from './modifiers.js';
import type { Attributes, WeaponDefinition } from './types.js';
import type { Rng } from './rng.js';
import { weaponAttrRules } from './tags.js';
import { balanceRoll, effectiveBalance } from './formulas.js';

const BASIC_DAMAGE: [number, number] = [1, 3];
const BASIC_BALANCE = 0.5;

export function weaponToModifiers(weapon: WeaponDefinition | undefined, attacker: Attributes, rng: Rng): Modifier[] {
  if (!weapon) {
    const balance = effectiveBalance(BASIC_BALANCE, attacker.dex);
    const rolled = balanceRoll(rng, BASIC_DAMAGE[0], BASIC_DAMAGE[1], balance);
    return [
      { source: 'unarmed', target: 'damage.base', op: '=', value: rolled },
      { source: 'unarmed:str', target: 'damage.flat', op: '+', value: attacker.str },
    ];
  }

  const rules = weaponAttrRules(weapon.tags);
  const balance = effectiveBalance(weapon.balance, rules.dexAmp ? attacker.dex : 0);
  const rolled = balanceRoll(rng, weapon.damage[0], weapon.damage[1], balance);
  const mods: Modifier[] = [
    { source: weapon.id, target: 'damage.base', op: '=', value: rolled },
  ];
  if (rules.strApplies) {
    mods.push({ source: 'attr:str', target: 'damage.flat', op: '+', value: attacker.str });
  }
  return mods;
}

export function skillToModifiers(skillModifiers?: Array<{ target: string; op?: string; value: number }>): Modifier[] {
  if (!skillModifiers) return [];
  return skillModifiers.map((m) => ({
    source: 'skill',
    target: m.target,
    op: (m.op ?? '×') as Modifier['op'],
    value: m.value,
  }));
}

export function sceneToModifiers(sceneModifiers: Modifier[]): Modifier[] {
  return sceneModifiers;
}
