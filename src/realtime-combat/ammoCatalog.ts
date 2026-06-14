import type { AmmoDefinition, AmmoType } from './types.js';

export const AMMO: readonly AmmoDefinition[] = [
  {
    id: 'basic-arrow',
    name: '箭矢',
    ammoType: 'arrow',
    speed: 360,
    range: 520,
    radius: 4,
    quantity: 999,
  },
  {
    id: 'basic-bullet',
    name: '子彈',
    ammoType: 'bullet',
    speed: 620,
    range: 430,
    radius: 3,
    quantity: 999,
  },
];

export function getDefaultAmmo(type: AmmoType): AmmoDefinition {
  const ammo = AMMO.find((item) => item.ammoType === type);
  if (!ammo) throw new Error(`Missing ammo for type: ${type}`);
  return ammo;
}
