import type { Attributes, DefenseStats, EquipmentDefinition, EquipmentLoadout, EquipmentSlot } from '../core/types.js';
import { LOADED_WEAPONS, LOADED_GEAR } from './equipmentLoader.js';
import { NATURAL_EQUIPMENT } from './naturalEquipmentCatalog.js';

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: '頭',
  neck: '頸',
  body: '甲',
  mainHand: '主手',
  offHand: '副手',
  ring1: '手飾1',
  ring2: '手飾2',
  waist: '腰',
  legs: '腿',
  feet: '腳',
};

export const WEAPONS = LOADED_WEAPONS;
export const GEAR = LOADED_GEAR;
export const EQUIPMENT: readonly EquipmentDefinition[] = [...WEAPONS, ...GEAR];
const ALL_EQUIPMENT: readonly EquipmentDefinition[] = [...EQUIPMENT, ...NATURAL_EQUIPMENT];

export const DEFAULT_LOADOUT: EquipmentLoadout = {
  head: null,
  neck: null,
  body: null,
  mainHand: null,
  offHand: null,
  ring1: null,
  ring2: null,
  waist: null,
  legs: null,
  feet: null,
};

export function getEquipment(id: string): EquipmentDefinition {
  const equipment = ALL_EQUIPMENT.find((item) => item.id === id);
  if (!equipment) throw new Error(`Unknown equipment: ${id}`);
  return equipment;
}

export function getWeapon(loadout: EquipmentLoadout) {
  const mainHand = loadout.mainHand ? getEquipment(loadout.mainHand) : null;
  if (!mainHand || mainHand.slot !== 'mainHand') throw new Error('Main hand must be a weapon');
  return mainHand;
}

export function getOffhandWeapon(loadout: EquipmentLoadout) {
  const normalized = normalizeLoadout(loadout);
  const offHand = normalized.offHand ? getEquipment(normalized.offHand) : null;
  return offHand?.slot === 'offHand' && 'damage' in offHand ? offHand : null;
}

export function equipmentOptionsFor(slot: EquipmentSlot): EquipmentDefinition[] {
  return EQUIPMENT.filter((item) => item.slot === slot);
}

export function normalizeLoadout(loadout: EquipmentLoadout): EquipmentLoadout {
  const weapon = getWeapon(loadout);
  return {
    ...loadout,
    offHand: weapon.twoHanded ? null : loadout.offHand,
  };
}

export function equipmentDefense(loadout: EquipmentLoadout): DefenseStats {
  const normalized = normalizeLoadout(loadout);
  const defense: DefenseStats = { armor: 0, reductionRate: 0, parryRate: 0, blockRate: 0 };

  for (const id of Object.values(normalized)) {
    if (!id) continue;
    const item = getEquipment(id);
    if ('damage' in item) {
      defense.parryRate += item.parryRate;
      defense.blockRate += item.blockRate ?? 0;
      continue;
    }
    defense.armor += item.armor;
    defense.reductionRate += item.reductionRate;
    defense.parryRate += item.parryRate;
    defense.blockRate += item.blockRate;
  }

  return {
    armor: defense.armor,
    reductionRate: Math.min(1, defense.reductionRate),
    parryRate: Math.min(1, defense.parryRate),
    blockRate: Math.min(1, defense.blockRate),
  };
}

export function applyEquipmentAttrModifiers(baseAttrs: Attributes, loadout: EquipmentLoadout): Attributes {
  const result = { ...baseAttrs };
  const normalized = normalizeLoadout(loadout);
  for (const id of Object.values(normalized)) {
    if (!id) continue;
    const item = getEquipment(id);
    if ('damage' in item) continue;
    if (!item.attrModifiers) continue;
    for (const mod of item.attrModifiers) {
      result[mod.attr] = Math.max(0, Math.min(255, result[mod.attr] + mod.value));
    }
  }
  return result;
}
