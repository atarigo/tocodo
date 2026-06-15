import type { DefenseStats, EquipmentDefinition, EquipmentLoadout, EquipmentSlot, GearDefinition, WeaponDefinition } from '../core/types.js';
import { NATURAL_EQUIPMENT } from './naturalEquipmentCatalog.js';

export const EQUIPMENT_SLOT_LABELS: Record<EquipmentSlot, string> = {
  mainHand: '主手',
  offHand: '副手',
  head: '頭',
  body: '身',
  legs: '腿',
  feet: '腳',
};

export const WEAPONS: readonly WeaponDefinition[] = [
  {
    id: 'iron-sword',
    name: '鐵劍',
    slot: 'mainHand',
    twoHanded: false,
    kind: '近戰',
    attackMode: 'melee',
    damage: [8, 14],
    balance: 0.45,
    interval: 1.8,
    range: 88,
    arc: Math.PI / 2,
    strApplies: true,
    agiApplies: true,
    dexAmp: true,
    parryRate: 0.1,
  },
  {
    id: 'dagger',
    name: '短刀',
    slot: 'mainHand',
    twoHanded: false,
    kind: '近戰',
    attackMode: 'melee',
    damage: [5, 9],
    balance: 0.55,
    interval: 1.1,
    range: 58,
    arc: (Math.PI * 70) / 180,
    strApplies: true,
    agiApplies: true,
    dexAmp: true,
    parryRate: 0.2,
  },
  {
    id: 'greatsword',
    name: '巨劍',
    slot: 'mainHand',
    twoHanded: true,
    kind: '近戰',
    attackMode: 'melee',
    damage: [16, 34],
    balance: 0.35,
    interval: 2.8,
    range: 118,
    arc: (Math.PI * 115) / 180,
    strApplies: true,
    agiApplies: true,
    dexAmp: true,
    parryRate: 0.05,
  },
  {
    id: 'spear',
    name: '長槍',
    slot: 'mainHand',
    twoHanded: true,
    kind: '近戰',
    attackMode: 'melee',
    damage: [10, 18],
    balance: 0.42,
    interval: 2.1,
    range: 138,
    arc: (Math.PI * 42) / 180,
    strApplies: true,
    agiApplies: true,
    dexAmp: true,
    parryRate: 0.08,
  },
  {
    id: 'hunting-bow',
    name: '獵弓',
    slot: 'mainHand',
    twoHanded: true,
    kind: '弓',
    attackMode: 'projectile',
    damage: [9, 19],
    balance: 0.4,
    interval: 2.0,
    range: 245,
    arc: Math.PI / 5,
    strApplies: true,
    agiApplies: true,
    dexAmp: true,
    parryRate: 0.05,
    projectile: { ammoType: 'arrow', shotsPerAttack: 1, spreadAngle: 0 },
  },
  {
    id: 'pistol',
    name: '手槍',
    slot: 'mainHand',
    twoHanded: false,
    kind: '槍',
    attackMode: 'projectile',
    damage: [12, 16],
    balance: 0.6,
    interval: 1.3,
    range: 220,
    arc: Math.PI / 8,
    strApplies: false,
    agiApplies: false,
    dexAmp: false,
    parryRate: 0,
    projectile: { ammoType: 'bullet', shotsPerAttack: 1, spreadAngle: 0 },
  },
  {
    id: 'revolver',
    name: '重型左輪',
    slot: 'offHand',
    twoHanded: false,
    kind: '槍',
    attackMode: 'projectile',
    damage: [15, 21],
    balance: 0.6,
    interval: 1.85,
    range: 200,
    arc: Math.PI / 8,
    strApplies: false,
    agiApplies: false,
    dexAmp: false,
    parryRate: 0,
    projectile: { ammoType: 'bullet', shotsPerAttack: 1, spreadAngle: 0 },
  },
  {
    id: 'offhand-dagger',
    name: '副手短刀',
    slot: 'offHand',
    twoHanded: false,
    kind: '近戰',
    attackMode: 'melee',
    damage: [4, 8],
    balance: 0.55,
    interval: 0.9,
    range: 52,
    arc: (Math.PI * 65) / 180,
    strApplies: true,
    agiApplies: true,
    dexAmp: true,
    parryRate: 0.08,
  },
  {
    id: 'rifle',
    name: '步槍',
    slot: 'mainHand',
    twoHanded: true,
    kind: '槍',
    attackMode: 'projectile',
    damage: [24, 32],
    balance: 0.65,
    interval: 2.2,
    range: 360,
    arc: Math.PI / 10,
    strApplies: false,
    agiApplies: false,
    dexAmp: false,
    parryRate: 0,
    projectile: { ammoType: 'bullet', shotsPerAttack: 1, spreadAngle: 0 },
  },
];

export const GEAR: readonly GearDefinition[] = [
  { id: 'wooden-shield', name: '木盾', slot: 'offHand', armor: 1, reductionRate: 0, parryRate: 0, blockRate: 0.25 },
  { id: 'leather-cap', name: '皮帽', slot: 'head', armor: 1, reductionRate: 0, parryRate: 0, blockRate: 0 },
  { id: 'leather-armor', name: '皮甲', slot: 'body', armor: 2, reductionRate: 0.03, parryRate: 0, blockRate: 0 },
  { id: 'leather-pants', name: '皮褲', slot: 'legs', armor: 1, reductionRate: 0.01, parryRate: 0, blockRate: 0 },
  { id: 'leather-boots', name: '皮靴', slot: 'feet', armor: 1, reductionRate: 0, parryRate: 0, blockRate: 0 },
  { id: 'iron-helm', name: '鐵盔', slot: 'head', armor: 2, reductionRate: 0.01, parryRate: 0, blockRate: 0 },
  { id: 'iron-armor', name: '鐵甲', slot: 'body', armor: 5, reductionRate: 0.08, parryRate: 0, blockRate: 0 },
  { id: 'iron-greaves', name: '鐵腿甲', slot: 'legs', armor: 3, reductionRate: 0.03, parryRate: 0, blockRate: 0 },
  { id: 'iron-boots', name: '鐵靴', slot: 'feet', armor: 2, reductionRate: 0.01, parryRate: 0, blockRate: 0 },
];

export const EQUIPMENT: readonly EquipmentDefinition[] = [...WEAPONS, ...GEAR];
const ALL_EQUIPMENT: readonly EquipmentDefinition[] = [...EQUIPMENT, ...NATURAL_EQUIPMENT];
export const DEFAULT_LOADOUT: EquipmentLoadout = {
  mainHand: 'iron-sword',
  offHand: null,
  head: null,
  body: null,
  legs: null,
  feet: null,
};

export function getEquipment(id: string): EquipmentDefinition {
  const equipment = ALL_EQUIPMENT.find((item) => item.id === id);
  if (!equipment) throw new Error(`Unknown equipment: ${id}`);
  return equipment;
}

export function getWeapon(loadout: EquipmentLoadout): WeaponDefinition {
  const mainHand = loadout.mainHand ? getEquipment(loadout.mainHand) : null;
  if (!mainHand || mainHand.slot !== 'mainHand') throw new Error('Main hand must be a weapon');
  return mainHand;
}

export function getOffhandWeapon(loadout: EquipmentLoadout): WeaponDefinition | null {
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
