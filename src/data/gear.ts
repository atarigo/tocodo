import type { Gear, GearSlot } from '../core/types.js';

export type { GearSlot };

/**
 * 裝備：護甲值（減算）、減傷率、格檔率（盾牌限定 30%〜45%）、屬性加成。
 * 空身沒有防禦：護甲值全部來自裝備。
 * 裝備走制式組合設計，不做隨機詞綴。
 */
export const GEAR: readonly Gear[] = [
  // ─ 防具 ─
  { id: 'leather-armor', price: 50, name: '皮甲', rank: 'D', slot: '防具', armor: 6, description: '護甲值 6。' },
  { id: 'cloth-robe', price: 50, name: '布袍', rank: 'D', slot: '防具', armor: 3, attrs: { wil: 15 }, description: '護甲值 3、意志 +15。' },
  { id: 'chainmail', price: 150, name: '鎖子甲', rank: 'C', slot: '防具', armor: 12, attrs: { agi: -10 }, description: '護甲值 12、敏捷 −10。' },
  { id: 'plate-armor', price: 400, name: '重板甲', rank: 'B', slot: '防具', armor: 22, reductionRate: 0.08, attrs: { agi: -25 }, description: '護甲值 22、減傷率 8%、敏捷 −25。' },
  // ─ 副手（盾牌：格檔率只有它會給） ─
  { id: 'round-shield', price: 50, name: '圓盾', rank: 'D', slot: '副手', armor: 3, blockRate: 0.3, description: '格檔率 30%、護甲值 3。' },
  { id: 'tower-shield', name: '塔盾', rank: 'B', slot: '副手', armor: 6, blockRate: 0.45, attrs: { agi: -15 }, description: '格檔率 45%、護甲值 6、敏捷 −15。副本限定。' },
  // ─ 飾品 ─
  { id: 'power-ring', price: 50, name: '力量戒指', rank: 'D', slot: '飾品', attrs: { str: 15 }, description: '力量 +15。' },
  { id: 'life-amulet', price: 150, name: '生命項鍊', rank: 'C', slot: '飾品', attrs: { vit: 20 }, description: '體質 +20。' },
  { id: 'gale-boots', price: 150, name: '疾風之靴', rank: 'C', slot: '飾品', attrs: { agi: 20 }, description: '敏捷 +20。' },
  { id: 'marksman-goggles', price: 150, name: '精準護目鏡', rank: 'C', slot: '飾品', attrs: { dex: 20 }, description: '靈巧 +20。' },
  { id: 'meditation-pendant', price: 150, name: '冥想吊墜', rank: 'C', slot: '飾品', attrs: { wil: 20 }, description: '意志 +20。' },
  { id: 'lucky-coin', price: 150, name: '幸運硬幣', rank: 'C', slot: '飾品', attrs: { luk: 20 }, description: '幸運 +20。' },
];

export const GEAR_BY_ID = new Map(GEAR.map((g) => [g.id, g]));

export function getGear(id: string): Gear {
  const gear = GEAR_BY_ID.get(id);
  if (!gear) throw new Error(`未知裝備 id: ${id}`);
  return gear;
}
