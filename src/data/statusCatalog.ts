import type { StatusId, StatusKind } from '../core/types.js';

export interface StatusDefinition {
  id: StatusId;
  name: string;
  kind: StatusKind;
  maxStacks: number;
  effectType: 'damage' | 'heal';
  tickInterval: number;
}

export const STATUSES: Record<StatusId, StatusDefinition> = {
  bleed: {
    id: 'bleed',
    name: '出血',
    kind: 'debuff',
    maxStacks: 3,
    effectType: 'damage',
    tickInterval: 1,
  },
  healing: {
    id: 'healing',
    name: '治療術',
    kind: 'buff',
    maxStacks: 0,
    effectType: 'heal',
    tickInterval: 1,
  },
};

export function statusById(id: StatusId): StatusDefinition {
  return STATUSES[id];
}
