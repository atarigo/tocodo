import type { ItemId } from '../core/types.js';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  effects: {
    kind: 'heal';
    resource: 'hp';
    ratio: number;
  }[];
}

export const ITEMS: Record<ItemId, ItemDefinition> = {
  smallHealthPotion: {
    id: 'smallHealthPotion',
    name: '生命藥水（小）',
    effects: [{ kind: 'heal', resource: 'hp', ratio: 0.25 }],
  },
};

export function itemById(id: ItemId): ItemDefinition {
  return ITEMS[id];
}
