import type { WeaponDefinition } from './types.js';

export const WEAPONS: readonly WeaponDefinition[] = [
  {
    id: 'iron-sword',
    name: '鐵劍',
    kind: '近戰',
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
    kind: '近戰',
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
    kind: '近戰',
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
    kind: '近戰',
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
];

export const DEFAULT_WEAPON_ID = 'iron-sword';

export function getWeapon(id: string): WeaponDefinition {
  const weapon = WEAPONS.find((item) => item.id === id);
  if (!weapon) throw new Error(`Unknown weapon: ${id}`);
  return weapon;
}
