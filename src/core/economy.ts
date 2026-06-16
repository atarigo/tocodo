import type { Rank } from './types.js';

// ─ 屬性升級花費（已定案 2026-06-12；A/S 級調漲）─
// 起始 10、上限 255；費用依「目標值」所在區間計價，區間即屬性的階級標記。
// 單屬性點滿 769,000；六邊形全滿 4,614,000。
const ATTR_BRACKETS: { max: number; cost: number; rank: Rank }[] = [
  { max: 50, cost: 100, rank: 'D' },
  { max: 100, cost: 300, rank: 'C' },
  { max: 150, cost: 1000, rank: 'B' },
  { max: 200, cost: 3000, rank: 'A' },
  { max: 255, cost: 10000, rank: 'S' },
];

export const ATTR_START = 10;
export const ATTR_MAX = 255;

/** 屬性目前值的階級標記 */
export function attrRank(value: number): Rank {
  for (const bracket of ATTR_BRACKETS) {
    if (value <= bracket.max) return bracket.rank;
  }
  return 'S';
}

/** 從 current 升到 current+1 的獎勵點花費 */
export function attrUpgradeCost(current: number): number {
  const target = Math.min(current + 1, ATTR_MAX);
  for (const bracket of ATTR_BRACKETS) {
    if (target <= bracket.max) return bracket.cost;
  }
  return ATTR_BRACKETS[ATTR_BRACKETS.length - 1].cost;
}

/** 從起始 10 升到 value 的累計獎勵點花費 */
export function attrTotalSpent(value: number): number {
  let total = 0;
  for (let v = ATTR_START; v < Math.min(value, ATTR_MAX); v++) {
    total += attrUpgradeCost(v);
  }
  return total;
}

