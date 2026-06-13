import type { Attributes, Unit } from './types.js';
import { addAttrs } from './attributes.js';
import { getGear } from '../data/gear.js';
import { getSkill } from '../data/skills.js';
import { getWeapon } from '../data/weapons.js';
import { WORLD_EFFECTS, type WorldEffects } from '../data/worldEffects.js';
import type { CharacterState } from '../state/model.js';

/**
 * 把「養成狀態 ＋ 世界效果」組裝成戰鬥單位。
 * 裝備詞綴在這裡烤死（直接進數值），戰鬥中的 buff/debuff 才走效果系統。
 * 空手＝沒有普攻；空身＝護甲值 0。
 */
export function buildPlayerUnit(
  character: CharacterState,
  world: WorldEffects = WORLD_EFFECTS,
): Unit {
  let attrs: Attributes = { ...character.attrs };
  let armor = 0;
  let reductionRate = 0;
  let blockRate = 0;

  for (const id of Object.values(character.equippedGear)) {
    const gear = getGear(id);
    if (gear.attrs) attrs = addAttrs(attrs, gear.attrs);
    armor += gear.armor ?? 0;
    reductionRate += gear.reductionRate ?? 0;
    blockRate += gear.blockRate ?? 0;
  }

  const weapon = character.equippedWeapon ? getWeapon(character.equippedWeapon) : null;

  return {
    name: character.name,
    attrs,
    weapon,
    parryRate: weapon?.parryRate ?? 0,
    blockRate: Math.min(0.45, blockRate),
    armor: Math.round(armor * (1 + world.守護壁壘)),
    reductionRate: Math.min(0.8, reductionRate),
    crushRate: 0,
    damageBonus: 1 + world.攻擊聖火,
    skills: character.skillSlots.map(getSkill),
  };
}
