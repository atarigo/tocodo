import type { Attributes, Rank } from '../core/types.js';
import type { Rng } from '../core/rng.js';

const RANK_MULTIPLIER: Record<Rank, number> = { D: 1, C: 2, B: 3, A: 4, S: 5 };

export function scaledEnemyAttrs(baseAttrs: Attributes, rank: Rank, rng: Rng): Attributes {
  const multiplier = RANK_MULTIPLIER[rank];
  const variance = 0.8 + rng() * 0.4;
  const scale = multiplier * variance;
  return {
    str: Math.min(255, Math.max(1, Math.round(baseAttrs.str * scale))),
    vit: Math.min(255, Math.max(1, Math.round(baseAttrs.vit * scale))),
    agi: Math.min(255, Math.max(1, Math.round(baseAttrs.agi * scale))),
    dex: Math.min(255, Math.max(1, Math.round(baseAttrs.dex * scale))),
    wil: Math.min(255, Math.max(1, Math.round(baseAttrs.wil * scale))),
    luk: Math.min(255, Math.max(1, Math.round(baseAttrs.luk * scale))),
  };
}
