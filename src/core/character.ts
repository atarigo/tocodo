import type { Combatant, Stats, Tag } from './types.js';
import { getEquipment } from '../data/equipment.js';
import { getSkill } from '../data/skills.js';
import { WORLD_EFFECTS, type WorldEffects } from '../data/worldEffects.js';
import type { CharacterData, PointAllocation, SaveData } from '../state/save.js';

export const BASE_STATS: Stats = { maxHp: 100, atk: 12, def: 4, spd: 8 };

/** 每點屬性點的效果 */
export const POINT_GAIN: PointAllocation = { hp: 10, atk: 2, def: 1, spd: 1 };

/** 遺產商店每級的永久加成 */
export const LEGACY_GAIN: PointAllocation = { hp: 15, atk: 2, def: 1, spd: 1 };

export const MAX_SKILL_SLOTS = 4;

export function upgradeCost(currentLevel: number): number {
  return (currentLevel + 1) * 10;
}

/**
 * 把「養成狀態 ＋ 世界效果」組裝成戰鬥模擬器的輸入。
 * 世界效果在這裡套用，模擬器本身不需要知道偉業系統的存在。
 */
export function buildPlayerCombatant(
  character: CharacterData,
  save: SaveData,
  world: WorldEffects = WORLD_EFFECTS,
): Combatant {
  const stats: Stats = {
    maxHp: BASE_STATS.maxHp + save.legacyUpgrades.hp * LEGACY_GAIN.hp + character.allocated.hp * POINT_GAIN.hp,
    atk: BASE_STATS.atk + save.legacyUpgrades.atk * LEGACY_GAIN.atk + character.allocated.atk * POINT_GAIN.atk,
    def: BASE_STATS.def + save.legacyUpgrades.def * LEGACY_GAIN.def + character.allocated.def * POINT_GAIN.def,
    spd: BASE_STATS.spd + save.legacyUpgrades.spd * LEGACY_GAIN.spd + character.allocated.spd * POINT_GAIN.spd,
  };

  const synergies: { tag: Tag; bonus: number }[] = [];
  for (const id of Object.values(character.equipped)) {
    const item = getEquipment(id);
    stats.maxHp += item.mods.maxHp ?? 0;
    stats.atk += item.mods.atk ?? 0;
    stats.def += item.mods.def ?? 0;
    stats.spd += item.mods.spd ?? 0;
    if (item.synergy) synergies.push(item.synergy);
  }

  stats.atk = Math.round(stats.atk * (1 + world.攻擊聖火));
  stats.def = Math.round(stats.def * (1 + world.守護壁壘));

  return {
    name: character.name,
    stats,
    skills: character.skillSlots.map(getSkill),
    synergies,
  };
}
