import type { ItemId } from './types.js';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  healHpRatio: number;
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  smallHealthPotion: {
    id: 'smallHealthPotion',
    name: '生命藥水（小）',
    healHpRatio: 0.25,
  },
};

export function itemById(id: ItemId): ItemDefinition {
  return ITEMS[id];
}
