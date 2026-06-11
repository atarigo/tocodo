import type { Combatant } from './types.js';
import { getSkill } from '../data/skills.js';
import { pick, type Rng } from './rng.js';

const MOB_NAMES = ['遊蕩魔物', '嗜血獵犬', '深淵行者', '腐化戰士', '虛空遊魂'] as const;
const BOSS_NAMES = ['樓層守衛', '深淵領主', '血月霸主'] as const;
const BOSS_SKILLS = ['heavy-slash', 'fireball', 'ice-spike'] as const;

export const BOSS_INTERVAL = 5;

export function isBossFloor(floor: number): boolean {
  return floor % BOSS_INTERVAL === 0;
}

/** 敵人強度只由層數決定，是整個遊戲的難度曲線所在 */
export function makeEnemy(floor: number, rng: Rng): Combatant {
  const base = {
    maxHp: 40 + 16 * floor,
    atk: 7 + Math.round(2.5 * floor),
    def: 1 + floor,
    spd: 6 + floor,
  };

  if (!isBossFloor(floor)) {
    return {
      name: `${pick(rng, MOB_NAMES)}（第 ${floor} 層）`,
      stats: base,
      skills: [],
      synergies: [],
    };
  }

  return {
    name: `${pick(rng, BOSS_NAMES)}（第 ${floor} 層頭目）`,
    stats: {
      maxHp: Math.round(base.maxHp * 1.6),
      atk: Math.round(base.atk * 1.15),
      def: base.def + 2,
      spd: base.spd,
    },
    skills: [getSkill(pick(rng, BOSS_SKILLS))],
    synergies: [],
  };
}

/** 強迫晉級：不能回頭刷低層，起始層緊跟歷史最高紀錄 */
export function startingFloor(highestCleared: number): number {
  return Math.max(1, highestCleared - 2);
}
