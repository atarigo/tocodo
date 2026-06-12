import type { Attributes, Priced, Rank } from '../core/types.js';

export type GearSlot = '防具' | '副手' | '飾品';

export interface Gear extends Priced {
  id: string;
  name: string;
  rank: Rank;
  slot: GearSlot;
  attrs?: Partial<Attributes>;
  /** 防禦兩段：減算（−）與減成（％） */
  defFlat?: number;
  defPct?: number;
  /** 盾牌：無條件的招架減傷（各盾各自設計） */
  parryFlat?: number;
  parryPct?: number;
  description: string;
}

export const GEAR: readonly Gear[] = [
  // 防具
  { id: 'leather-armor', price: 50, name: '皮甲', rank: 'D', slot: '防具', defFlat: 4, description: '基本的防護。' },
  { id: 'chainmail', price: 150, name: '鎖子甲', rank: 'C', slot: '防具', defFlat: 8, attrs: { agi: -1 }, description: '紮實但略微笨重。' },
  { id: 'plate-armor', price: 400, name: '重板甲', rank: 'B', slot: '防具', defFlat: 14, defPct: 0.1, attrs: { agi: -3 }, description: '厚重的全身防護，犧牲敏捷。' },
  { id: 'cloth-robe', price: 50, name: '布袍', rank: 'D', slot: '防具', defFlat: 2, attrs: { wil: 2 }, description: '幾乎沒有防護，但有助於凝神。' },
  // 副手（盾牌）
  { id: 'round-shield', price: 50, name: '圓盾', rank: 'D', slot: '副手', defFlat: 2, parryFlat: 8, parryPct: 0.15, description: '招架時額外減傷 −8、15%。' },
  { id: 'tower-shield', name: '塔盾', rank: 'B', slot: '副手', defFlat: 4, parryFlat: 18, parryPct: 0.3, attrs: { agi: -2 }, description: '招架時額外減傷 −18、30%，但笨重。' },
  // 飾品
  { id: 'power-ring', price: 50, name: '力量戒指', rank: 'D', slot: '飾品', attrs: { str: 2 }, description: '力量 +2。' },
  { id: 'life-amulet', price: 150, name: '生命項鍊', rank: 'C', slot: '飾品', attrs: { vit: 3 }, description: '體質 +3。' },
  { id: 'gale-boots', price: 150, name: '疾風之靴', rank: 'C', slot: '飾品', attrs: { agi: 3 }, description: '敏捷 +3。' },
  { id: 'marksman-goggles', price: 150, name: '精準護目鏡', rank: 'C', slot: '飾品', attrs: { dex: 3 }, description: '靈巧 +3。' },
  { id: 'meditation-pendant', price: 150, name: '冥想吊墜', rank: 'C', slot: '飾品', attrs: { wil: 3 }, description: '意志 +3。' },
  { id: 'lucky-coin', price: 150, name: '幸運硬幣', rank: 'C', slot: '飾品', attrs: { luk: 3 }, description: '幸運 +3。' },
];

export const GEAR_BY_ID = new Map(GEAR.map((g) => [g.id, g]));

export function getGear(id: string): Gear {
  const gear = GEAR_BY_ID.get(id);
  if (!gear) throw new Error(`未知裝備 id: ${id}`);
  return gear;
}
