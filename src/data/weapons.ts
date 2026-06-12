import type { Weapon } from '../core/types.js';

/** 空手：沒有武器時的預設 */
export const FIST: Weapon = {
  id: 'fist',
  name: '空手',
  rank: 'D',
  kind: '近戰',
  damage: [2, 5],
  interval: 1.6,
  strScaling: 1.0,
  agiSpeed: true,
  dexSpread: true,
  description: '赤手空拳。',
};

export const WEAPONS: readonly Weapon[] = [
  // 近戰：傷害吃力量、速度吃敏捷、大小傷吃靈巧
  {
    id: 'iron-sword', price: 50,
    name: '鐵劍',
    rank: 'D',
    kind: '近戰',
    damage: [8, 14],
    interval: 1.8,
    strScaling: 1.2,
    agiSpeed: true,
    dexSpread: true,
    description: '可靠的入門武器。',
  },
  {
    id: 'greatsword', price: 150,
    name: '巨劍',
    rank: 'C',
    kind: '近戰',
    damage: [14, 30],
    interval: 2.8,
    strScaling: 1.6,
    agiSpeed: true,
    dexSpread: true,
    description: '沉重而致命，大小傷區間極大，吃發揮度。',
  },
  {
    id: 'dagger', price: 50,
    name: '短刀',
    rank: 'D',
    kind: '近戰',
    damage: [5, 9],
    interval: 1.1,
    strScaling: 0.7,
    agiSpeed: true,
    dexSpread: true,
    description: '出手極快，適合敏捷型。',
  },
  // 槍：傷害只看武器與子彈、射速只看武器、不吃力量敏捷
  {
    id: 'pistol', price: 50,
    name: '手槍',
    rank: 'D',
    kind: '槍',
    damage: [12, 16],
    interval: 1.3,
    strScaling: 0,
    agiSpeed: false,
    dexSpread: false,
    description: '傷害不高，但穩定且不依賴屬性，靠機制配合取勝。',
  },
  {
    id: 'rifle', price: 150,
    name: '步槍',
    rank: 'C',
    kind: '槍',
    damage: [24, 32],
    interval: 2.2,
    strScaling: 0,
    agiSpeed: false,
    dexSpread: false,
    description: '射速固定，傷害區間穩定。',
  },
  // 弓：傷害吃力量，其餘同近戰
  {
    id: 'hunting-bow', price: 50,
    name: '獵弓',
    rank: 'D',
    kind: '弓',
    damage: [9, 19],
    interval: 2.0,
    strScaling: 1.0,
    agiSpeed: true,
    dexSpread: true,
    description: '吃力量的遠程武器。',
  },
  // 法杖：拿來敲是近戰，特效在詠唱與精神
  {
    id: 'apprentice-staff', price: 50,
    name: '學徒法杖',
    rank: 'D',
    kind: '法杖',
    damage: [4, 8],
    interval: 2.0,
    strScaling: 0.5,
    agiSpeed: true,
    dexSpread: true,
    castTimeMult: 0.85,
    mpCostMult: 0.9,
    description: '詠唱時間 −15%、精神消耗 −10%。拿來敲人也行，就是不太痛。',
  },
  {
    id: 'sage-staff',
    name: '賢者法杖',
    rank: 'B',
    kind: '法杖',
    damage: [5, 10],
    interval: 2.2,
    strScaling: 0.5,
    agiSpeed: true,
    dexSpread: true,
    castTimeMult: 0.7,
    mpCostMult: 0.8,
    description: '詠唱時間 −30%、精神消耗 −20%。',
  },
];

export const WEAPON_BY_ID = new Map([FIST, ...WEAPONS].map((w) => [w.id, w]));

export function getWeapon(id: string): Weapon {
  const weapon = WEAPON_BY_ID.get(id);
  if (!weapon) throw new Error(`未知武器 id: ${id}`);
  return weapon;
}
