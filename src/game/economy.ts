import type { AttrKey, Priced, Rank } from '../core/types.js';
import { BASE_ATTRS } from '../state/model.js';

/** 下一點主屬性的價格（舊原型公式，現行遊戲暫用；整合攻擊表時改用下方定案版） */
export function attrPrice(key: AttrKey, current: number): number {
  return (current - BASE_ATTRS[key] + 1) * 10;
}

// ─ 屬性升級花費（已定案 2026-06-12）─
// 起始 10、上限 255；費用依「目標值」所在區間計價，區間即屬性的階級標記。
// 單屬性點滿 444,000；六邊形全滿 2,664,000。
const ATTR_BRACKETS: { max: number; cost: number; rank: Rank }[] = [
  { max: 50, cost: 100, rank: 'D' },
  { max: 100, cost: 300, rank: 'C' },
  { max: 150, cost: 1000, rank: 'B' },
  { max: 200, cost: 2000, rank: 'A' },
  { max: 255, cost: 5000, rank: 'S' },
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

/** 從 current 升到 current+1 的點數花費 */
export function attrUpgradeCost(current: number): number {
  const target = Math.min(current + 1, ATTR_MAX);
  for (const bracket of ATTR_BRACKETS) {
    if (target <= bracket.max) return bracket.cost;
  }
  return ATTR_BRACKETS[ATTR_BRACKETS.length - 1].cost;
}

/** 從起始 10 升到 value 的累計花費 */
export function attrTotalSpent(value: number): number {
  let total = 0;
  for (let v = ATTR_START; v < Math.min(value, ATTR_MAX); v++) {
    total += attrUpgradeCost(v);
  }
  return total;
}

/**
 * 一般商店是否販售：沒有 price 的內容不出售（通常較強或特殊，只能副本取得）。
 * secretPrice 屬於秘密商店，這裡不處理。
 */
export function shopPrice(item: Priced): number | null {
  return item.price ?? null;
}

/** 攻克一層的貨幣報酬 */
export function floorReward(floor: number, isBoss: boolean): number {
  return (12 + 8 * floor) * (isBoss ? 2 : 1);
}
