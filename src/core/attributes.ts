import type { Attributes } from './types.js';
import type { Rng } from './rng.js';

/** 六主屬性算出的衍生值（共用公式；個別技能的係數在技能資料裡各自宣告） */
export interface Derived {
  maxHp: number;
  maxMp: number;
  /** 每秒精神恢復 */
  mpRegen: number;
  /** 敏捷：完全無傷無效果 */
  dodge: number;
  /** 靈巧：效果照發、傷害另計招架減傷 */
  parry: number;
  /** 幸運：總有倒楣的時候，命中永遠堆不滿 */
  luckyEvade: number;
  critChance: number;
  vitalChance: number;
  /** 發揮度：大小傷擲骰的偏移指數（越小越偏向高段） */
  spreadExp: number;
  /** 意志：縮短狀態持續時間的比例 */
  statusResist: number;
  /** 體質：感染類強度減低比例 */
  infectionResist: number;
}

export function deriveStats(a: Attributes): Derived {
  return {
    maxHp: 50 + a.vit * 15,
    maxMp: 20 + a.wil * 8,
    mpRegen: 0.3 + a.wil * 0.06,
    dodge: Math.min(0.3, a.agi * 0.004),
    parry: Math.min(0.3, a.dex * 0.004),
    luckyEvade: Math.min(0.15, 0.02 + a.luk * 0.002),
    critChance: Math.min(0.4, 0.03 + a.luk * 0.004),
    vitalChance: Math.min(0.2, a.luk * 0.003),
    spreadExp: 25 / (25 + a.dex),
    statusResist: Math.min(0.7, a.wil * 0.012),
    infectionResist: Math.min(0.6, a.vit * 0.012),
  };
}

/**
 * 大小傷擲骰。靈巧代表發揮度：低靈巧集中在區間低段，高靈巧集中在高段。
 * 實作：rng()^exp，exp 隨靈巧下降，擲骰分布往 1 偏移。
 */
export function rollSpread(rng: Rng, [min, max]: [number, number], spreadExp: number): number {
  return min + (max - min) * Math.pow(rng(), spreadExp);
}

/** 不吃發揮度時取區間中點（槍類、宣告不吃大小傷的技能） */
export function midRoll([min, max]: [number, number]): number {
  return (min + max) / 2;
}

export function zeroAttrs(): Attributes {
  return { str: 0, vit: 0, agi: 0, dex: 0, wil: 0, luk: 0 };
}

export function addAttrs(base: Attributes, extra: Partial<Attributes>): Attributes {
  return {
    str: base.str + (extra.str ?? 0),
    vit: base.vit + (extra.vit ?? 0),
    agi: base.agi + (extra.agi ?? 0),
    dex: base.dex + (extra.dex ?? 0),
    wil: base.wil + (extra.wil ?? 0),
    luk: base.luk + (extra.luk ?? 0),
  };
}
