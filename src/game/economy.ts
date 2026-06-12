import type { AttrKey, Priced } from '../core/types.js';
import { BASE_ATTRS } from '../state/model.js';

/** 下一點主屬性的價格：買越高越貴 */
export function attrPrice(key: AttrKey, current: number): number {
  return (current - BASE_ATTRS[key] + 1) * 10;
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
