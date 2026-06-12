import type { Attributes, Unit } from './types.js';
import { addAttrs } from './attributes.js';
import { getGear } from '../data/gear.js';
import { getSkill } from '../data/skills.js';
import { FIST, getWeapon } from '../data/weapons.js';
import { WORLD_EFFECTS, type WorldEffects } from '../data/worldEffects.js';
import type { CharacterState } from '../state/model.js';

/**
 * 把「養成狀態 ＋ 世界效果」組裝成戰鬥單位。
 * 世界效果在這裡套用，戰鬥模擬器不需要知道偉業系統的存在。
 */
export function buildPlayerUnit(
  character: CharacterState,
  world: WorldEffects = WORLD_EFFECTS,
): Unit {
  let attrs: Attributes = { ...character.attrs };
  const defense = { flat: 0, pct: 0, parryFlat: 0, parryPct: 0 };

  for (const id of Object.values(character.equippedGear)) {
    const gear = getGear(id);
    if (gear.attrs) attrs = addAttrs(attrs, gear.attrs);
    defense.flat += gear.defFlat ?? 0;
    defense.pct += gear.defPct ?? 0;
    defense.parryFlat += gear.parryFlat ?? 0;
    defense.parryPct += gear.parryPct ?? 0;
  }
  defense.flat = Math.round(defense.flat * (1 + world.守護壁壘));
  defense.pct = Math.min(0.6, defense.pct);

  return {
    name: character.name,
    attrs,
    defense,
    weapon: character.equippedWeapon ? getWeapon(character.equippedWeapon) : FIST,
    skills: character.skillSlots.map(getSkill),
    damageMult: 1 + world.攻擊聖火,
  };
}
