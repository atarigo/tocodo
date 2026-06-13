import type { Attributes, Unit, Weapon, WeaponKind } from './types.js';
import { BOSS_CRUSH_RATE } from './attackTable.js';
import { clampAttr } from './attributes.js';
import { getSkill } from '../data/skills.js';
import { pick, type Rng } from './rng.js';

export const BOSS_INTERVAL = 5;

export function isBossFloor(floor: number): boolean {
  return floor % BOSS_INTERVAL === 0;
}

/** 強迫晉級：不能回頭刷低層，起始層緊跟本人最高紀錄 */
export function startingFloor(highestCleared: number): number {
  return Math.max(1, highestCleared - 2);
}

interface Archetype {
  name: string;
  bossName: string;
  weights: Attributes;
  weaponKind: WeaponKind;
  interval: number;
  /** 武器傷害區間的型別倍率（快攻型低、重擊型高） */
  damageMult: number;
  balance: number;
  skills: string[];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: '嗜血獵犬',
    bossName: '血月狼王',
    weights: { str: 3, vit: 2, agi: 4, dex: 2, wil: 0, luk: 1 },
    weaponKind: '近戰',
    interval: 1.3,
    damageMult: 0.7,
    balance: 0.5,
    skills: ['rend'],
  },
  {
    name: '腐化戰士',
    bossName: '深淵領主',
    weights: { str: 4, vit: 3, agi: 1, dex: 2, wil: 0, luk: 1 },
    weaponKind: '近戰',
    interval: 2.4,
    damageMult: 1.2,
    balance: 0.4,
    skills: ['heavy-slash', 'armor-break'],
  },
  {
    name: '虛空射手',
    bossName: '千瞳狙獵者',
    weights: { str: 0, vit: 2, agi: 2, dex: 4, wil: 0, luk: 2 },
    weaponKind: '槍',
    interval: 1.9,
    damageMult: 1.0,
    balance: 0.6,
    skills: ['piercing-shot'],
  },
  {
    name: '墮落巫師',
    bossName: '焚世法皇',
    weights: { str: 0, vit: 2, agi: 1, dex: 2, wil: 5, luk: 1 },
    weaponKind: '法杖',
    interval: 2.2,
    damageMult: 0.6,
    balance: 0.45,
    skills: ['fireball', 'ice-bolt'],
  },
];

/**
 * 敵人與玩家走同一套屬性與公式（0〜255、起始 10），強度只由層數決定。
 * 頭目：屬性預算 ×1.4、普攻帶碾壓（統一預設 15%）。
 * 數值為暫定，靠模擬與實玩調整。
 */
export function makeEnemy(floor: number, rng: Rng): Unit {
  const arch = pick(rng, ARCHETYPES);
  const boss = isBossFloor(floor);
  const budget = (40 + 16 * floor) * (boss ? 1.4 : 1);
  const totalWeight = Object.values(arch.weights).reduce((a, b) => a + b, 0);

  const attrs: Attributes = { str: 10, vit: 10, agi: 10, dex: 10, wil: 10, luk: 10 };
  for (const [key, weight] of Object.entries(arch.weights) as [keyof Attributes, number][]) {
    attrs[key] = clampAttr(attrs[key] + Math.round((budget * weight) / totalWeight));
  }

  const dmgMult = arch.damageMult * (boss ? 1.15 : 1);
  const isGun = arch.weaponKind === '槍';
  const weapon: Weapon = {
    id: `natural-${arch.weaponKind}`,
    name: boss ? '頭目的兇器' : '兇器',
    rank: 'D',
    kind: arch.weaponKind,
    damage: [Math.round((3 + 1.6 * floor) * dmgMult), Math.round((6 + 2.6 * floor) * dmgMult)],
    balance: arch.balance,
    interval: arch.interval,
    strApplies: !isGun,
    agiApplies: !isGun,
    dexAmp: !isGun,
    parryRate: 0.1,
    castTimeMult: arch.weaponKind === '法杖' ? 0.85 : undefined,
    description: '',
  };

  return {
    name: boss ? `${arch.bossName}（第 ${floor} 層頭目）` : `${arch.name}（第 ${floor} 層）`,
    attrs,
    weapon,
    parryRate: weapon.parryRate,
    blockRate: 0,
    armor: Math.round(floor * 0.8) + (boss ? 4 : 0),
    reductionRate: boss ? 0.1 : 0,
    crushRate: boss ? BOSS_CRUSH_RATE : 0,
    damageBonus: 1,
    skills: arch.skills.map(getSkill),
  };
}
