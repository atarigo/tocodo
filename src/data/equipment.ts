import type { Equipment } from '../core/types.js';

export const EQUIPMENT: readonly Equipment[] = [
  // 武器
  { id: 'iron-sword', name: '鐵劍', slot: '武器', mods: { atk: 4 } },
  { id: 'steel-greatsword', name: '精鋼大劍', slot: '武器', mods: { atk: 8, spd: -1 } },
  { id: 'flame-blade', name: '烈焰之刃', slot: '武器', mods: { atk: 5 }, synergy: { tag: '火焰', bonus: 0.3 } },
  { id: 'frost-staff', name: '冰霜法杖', slot: '武器', mods: { atk: 4 }, synergy: { tag: '冰霜', bonus: 0.35 } },
  { id: 'blood-scimitar', name: '嗜血彎刀', slot: '武器', mods: { atk: 6 }, synergy: { tag: '血祭', bonus: 0.3 } },
  { id: 'fighter-gloves', name: '武鬥拳套', slot: '武器', mods: { atk: 3, spd: 3 } },
  // 防具
  { id: 'leather-armor', name: '皮甲', slot: '防具', mods: { def: 3 } },
  { id: 'chainmail', name: '鎖子甲', slot: '防具', mods: { def: 6, spd: -1 } },
  { id: 'flame-cloak', name: '烈焰披風', slot: '防具', mods: { def: 4 }, synergy: { tag: '火焰', bonus: 0.15 } },
  { id: 'frost-plate', name: '寒冰重鎧', slot: '防具', mods: { def: 8, spd: -2 }, synergy: { tag: '冰霜', bonus: 0.15 } },
  { id: 'feather-robe', name: '輕羽衣', slot: '防具', mods: { def: 2, spd: 4 } },
  // 飾品
  { id: 'power-ring', name: '力量戒指', slot: '飾品', mods: { atk: 3 } },
  { id: 'life-amulet', name: '生命項鍊', slot: '飾品', mods: { maxHp: 30 } },
  { id: 'gale-boots', name: '疾風之靴', slot: '飾品', mods: { spd: 5 } },
  { id: 'blood-emblem', name: '血色徽章', slot: '飾品', mods: { maxHp: 15 }, synergy: { tag: '血祭', bonus: 0.2 } },
  { id: 'warrior-medal', name: '戰士勳章', slot: '飾品', mods: { atk: 2, def: 2 } },
];

export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));

export function getEquipment(id: string): Equipment {
  const item = EQUIPMENT_BY_ID.get(id);
  if (!item) throw new Error(`未知裝備 id: ${id}`);
  return item;
}
