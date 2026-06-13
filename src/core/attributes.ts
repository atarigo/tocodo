import type { Attributes } from './types.js';

export const ATTR_MIN = 0;
export const ATTR_MAX = 255;

export function clampAttr(value: number): number {
  return Math.min(ATTR_MAX, Math.max(ATTR_MIN, value));
}

export function zeroAttrs(): Attributes {
  return { str: 0, vit: 0, agi: 0, dex: 0, wil: 0, luk: 0 };
}

/** 屬性相加並夾在 0〜255（裝備可能給負值，例如重甲 −敏捷） */
export function addAttrs(base: Attributes, extra: Partial<Attributes>): Attributes {
  return {
    str: clampAttr(base.str + (extra.str ?? 0)),
    vit: clampAttr(base.vit + (extra.vit ?? 0)),
    agi: clampAttr(base.agi + (extra.agi ?? 0)),
    dex: clampAttr(base.dex + (extra.dex ?? 0)),
    wil: clampAttr(base.wil + (extra.wil ?? 0)),
    luk: clampAttr(base.luk + (extra.luk ?? 0)),
  };
}
