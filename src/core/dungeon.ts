import type { Attributes, Unit, Weapon, WeaponKind } from './types.js';
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
  skills: string[];
}

const ARCHETYPES: readonly Archetype[] = [
  {
    name: '嗜血獵犬',
    bossName: '血月狼王',
    weights: { str: 3, vit: 2, agi: 4, dex: 2, wil: 1, luk: 1 },
    weaponKind: '近戰',
    interval: 1.3,
    damageMult: 0.7,
    skills: ['rend'],
  },
  {
    name: '腐化戰士',
    bossName: '深淵領主',
    weights: { str: 4, vit: 3, agi: 1, dex: 2, wil: 1, luk: 1 },
    weaponKind: '近戰',
    interval: 2.4,
    damageMult: 1.2,
    skills: ['heavy-slash', 'armor-break'],
  },
  {
    name: '虛空射手',
    bossName: '千瞳狙獵者',
    weights: { str: 1, vit: 2, agi: 2, dex: 4, wil: 1, luk: 2 },
    weaponKind: '槍',
    interval: 1.9,
    damageMult: 1.0,
    skills: ['piercing-shot'],
  },
  {
    name: '墮落巫師',
    bossName: '焚世法皇',
    weights: { str: 1, vit: 2, agi: 1, dex: 2, wil: 5, luk: 1 },
    weaponKind: '法杖',
    interval: 2.2,
    damageMult: 0.6,
    skills: ['fireball', 'ice-bolt'],
  },
];

/** 敵人與玩家走同一套屬性與公式，強度只由層數決定 */
export function makeEnemy(floor: number, rng: Rng): Unit {
  const arch = pick(rng, ARCHETYPES);
  const boss = isBossFloor(floor);
  const budget = (9 + 4 * floor) * (boss ? 1.4 : 1);
  const totalWeight = Object.values(arch.weights).reduce((a, b) => a + b, 0);

  const attrs = { str: 3, vit: 3, agi: 3, dex: 3, wil: 3, luk: 3 } satisfies Attributes;
  for (const [key, weight] of Object.entries(arch.weights) as [keyof Attributes, number][]) {
    attrs[key] += Math.round((budget * weight) / totalWeight);
  }

  const dmgMult = arch.damageMult * (boss ? 1.15 : 1);
  const weapon: Weapon = {
    id: `natural-${arch.weaponKind}`,
    name: boss ? '頭目的兇器' : '兇器',
    rank: 'D',
    kind: arch.weaponKind,
    damage: [Math.round((2 + 1.8 * floor) * dmgMult), Math.round((5 + 2.8 * floor) * dmgMult)],
    interval: arch.interval,
    strScaling: arch.weaponKind === '槍' ? 0 : 1.0,
    agiSpeed: arch.weaponKind !== '槍',
    dexSpread: arch.weaponKind !== '槍',
    castTimeMult: arch.weaponKind === '法杖' ? 0.85 : undefined,
    description: '',
  };

  return {
    name: boss ? `${arch.bossName}（第 ${floor} 層頭目）` : `${arch.name}（第 ${floor} 層）`,
    attrs,
    defense: {
      flat: Math.round(floor * 0.5),
      pct: boss ? 0.1 : 0,
      parryFlat: 0,
      parryPct: 0,
    },
    weapon,
    skills: arch.skills.map(getSkill),
    damageMult: 1,
  };
}
